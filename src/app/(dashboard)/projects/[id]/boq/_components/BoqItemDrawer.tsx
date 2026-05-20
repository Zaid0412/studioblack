"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { toast } from "@/components/ui/useToast";
import type { BoqItemWithComputed, BoqSection, UserRole } from "@/types";
import type { BoqItemPhase } from "@/lib/validations";
import { isExternalViewer } from "@/lib/roles";
import { useBoqMutations } from "@/hooks/useBoqMutations";
import { BoqEditableCell } from "./BoqEditableCell";
import { BoqChangeRequestDialog } from "./BoqChangeRequestDialog";
import type { UpdateItemPayload } from "@/lib/api/boq";
import {
  formatCurrency,
  formatOptionalCurrency,
  formatPct,
  formatQty,
  getLegalPhaseTransitions,
  isDestructivePhase,
  parseOptionalNumber,
  phaseToLabel,
  phaseToVariant,
  marginTier,
  toNum,
} from "../_lib/formatters";

interface BoqItemDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  item: BoqItemWithComputed | null;
  sections: BoqSection[];
  currency: string;
  minimumMarginPct: string;
  canEdit: boolean;
  /** Caller's role — gates phase-transition buttons per server permission matrix. */
  role: UserRole | null;
  /** Current viewer's user id — used to derive `isCreator`. */
  currentUserId: string | null;
  /** BOQ.created_by — used to derive `isCreator` for the 4-eyes rule. */
  boqCreatorId: string | null;
  /**
   * Optional delete handler — wired up by the parent so the existing
   * ConfirmDialog flow stays the single source of truth. Drawer just
   * emits the request; parent decides whether to close + show confirm.
   */
  onDelete?: (item: BoqItemWithComputed) => void;
}

/** Action-button label for each target phase. */
const PHASE_ACTION_LABEL: Record<BoqItemPhase, string> = {
  draft: "Move to Draft",
  internal_review: "Submit for Review",
  internally_approved: "Approve",
  submitted_to_client: "Send to Client",
  client_approved: "Mark Client Approved",
  change_requested: "Request Changes",
};

const NOTES_TEXTAREA_CLS =
  "rounded-lg border border-border-default bg-bg-input px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/30 resize-y disabled:opacity-60";

/** Right-side drawer with full item detail, notes editing, and lifecycle transitions. */
export function BoqItemDrawer({
  open,
  onOpenChange,
  projectId,
  item,
  sections,
  currency,
  minimumMarginPct,
  canEdit,
  role,
  currentUserId,
  boqCreatorId,
  onDelete,
}: BoqItemDrawerProps) {
  const { updateItem, setItemPhase } = useBoqMutations(projectId);
  const isExternal = isExternalViewer(role);
  const [notes, setNotes] = useState("");
  const [clientNotes, setClientNotes] = useState("");
  const [savingNotes, setSavingNotes] = useState(false);
  // True while ANY inline-edit cell is mid-PATCH. Used to disable the other
  // cells so a fast user can't blur cell A → blur cell B before A returns
  // and have B's PATCH go out with a stale `item.updated_at` (→ 409 + a
  // silently-lost edit).
  const [savingField, setSavingField] = useState(false);
  const [transitioning, setTransitioning] = useState<BoqItemPhase | null>(null);
  const [changeRequestOpen, setChangeRequestOpen] = useState(false);

  // Seed notes only when a new drawer opens — revalidations must not clobber edits.
  useEffect(() => {
    if (!open || !item) return;
    setNotes(item.notes ?? "");
    setClientNotes(item.client_notes ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, item?.id]);

  if (!item) return null;

  const section = sections.find((s) => s.id === item.section_id) ?? null;
  const tier = marginTier(toNum(item.margin_pct), toNum(minimumMarginPct));
  const marginColor =
    tier === "success"
      ? "text-success"
      : tier === "warning"
        ? "text-warning"
        : "text-error";
  const notesDirty =
    (notes ?? "") !== (item.notes ?? "") ||
    (clientNotes ?? "") !== (item.client_notes ?? "");

  const fireTransition = async (next: BoqItemPhase, comment?: string) => {
    setTransitioning(next);
    try {
      await setItemPhase(item.id, next, comment ? { comment } : undefined);
      toast({
        title: `Marked ${phaseToLabel(next)}`,
        variant: "success",
      });
    } finally {
      setTransitioning(null);
    }
  };

  const handleTransition = (next: BoqItemPhase) => {
    if (isDestructivePhase(next)) {
      setChangeRequestOpen(true);
      return;
    }
    void fireTransition(next);
  };

  const handleSaveNotes = async () => {
    setSavingNotes(true);
    try {
      await updateItem(item.id, {
        updatedAt: item.updated_at,
        notes: notes.trim() || null,
        clientNotes: clientNotes.trim() || null,
      });
      toast({ title: "Notes saved", variant: "success" });
    } finally {
      setSavingNotes(false);
    }
  };

  const saveField = async (patch: Partial<UpdateItemPayload>) => {
    setSavingField(true);
    try {
      await updateItem(item.id, { updatedAt: item.updated_at, ...patch });
    } finally {
      setSavingField(false);
    }
  };

  /**
   * Persist a dimension change and re-run the L × B × H product into
   * `quantity` so the line stays in sync with its measurements. The
   * incoming `next` is the new value of `key`; the other two
   * dimensions are read from the current item. Blank dimensions are
   * skipped from the product (matches the create-sheet behaviour).
   */
  const saveDimension = async (
    key: "length" | "breadth" | "height",
    next: string
  ) => {
    const parsed = parseOptionalNumber(next);
    const dims: Record<"length" | "breadth" | "height", number | null> = {
      length: parseOptionalNumber(item.length ?? ""),
      breadth: parseOptionalNumber(item.breadth ?? ""),
      height: parseOptionalNumber(item.height ?? ""),
    };
    dims[key] = parsed;
    const positives = Object.values(dims).filter(
      (n): n is number => n != null && Number.isFinite(n) && n > 0
    );
    const patch: Partial<UpdateItemPayload> = { [key]: parsed };
    if (positives.length > 0) {
      patch.quantity = Number(positives.reduce((a, b) => a * b, 1).toFixed(6));
    }
    await saveField(patch);
  };

  const fieldsDisabled = !canEdit || savingField;

  // Show only transitions the viewer's role can actually fire — surfaces
  // Mark Client Approved to clients even though `canEdit` is false for them.
  const allowedNext = getLegalPhaseTransitions(item.phase, {
    role,
    actorId: currentUserId,
    boqCreatorId,
  });

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent>
          <SheetHeader>
            <div className="flex items-center gap-2 text-xs font-mono text-text-muted">
              {item.item_code}
              {section && <span>· {section.title}</span>}
            </div>
            <SheetTitle>{item.description}</SheetTitle>
            <SheetDescription>
              {formatQty(item.quantity)} {item.unit} ·{" "}
              {formatCurrency(item.sell_price, currency)}
            </SheetDescription>
            <div className="flex flex-wrap gap-2 pt-2">
              <Badge variant={phaseToVariant(item.phase)}>
                {phaseToLabel(item.phase)}
              </Badge>
              {item.is_provisional && (
                <Badge variant="warning">provisional</Badge>
              )}
              {item.is_excluded && <Badge variant="archived">excluded</Badge>}
              {item.margin_alert && (
                <Badge variant="error" className="gap-1">
                  <AlertTriangle className="h-3 w-3" /> margin below floor
                </Badge>
              )}
              {item.over_budget && (
                <Badge variant="error" className="gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  {item.budget_variance_pct !== null
                    ? `${item.budget_variance_pct}% over budget`
                    : "over budget"}
                </Badge>
              )}
            </div>
          </SheetHeader>

          <SheetBody className="flex flex-col gap-5">
            <section className="flex flex-col gap-3">
              <EditableField
                label="Description"
                disabled={fieldsDisabled}
                value={item.description}
                display={item.description}
                onSave={(next) => saveField({ description: next })}
              />
              <div className="grid grid-cols-2 gap-3">
                <EditableField
                  label="Item code"
                  disabled={fieldsDisabled}
                  value={item.item_code}
                  display={item.item_code}
                  onSave={(next) => saveField({ itemCode: next })}
                  inputClassName="font-mono"
                />
                <EditableField
                  label="Unit"
                  disabled={fieldsDisabled}
                  value={item.unit}
                  display={item.unit}
                  onSave={(next) => saveField({ unit: next })}
                />
              </div>
            </section>

            <section className="grid grid-cols-2 gap-3 text-sm">
              <EditableField
                label="Quantity"
                disabled={fieldsDisabled}
                mode="number"
                min={0}
                value={item.quantity}
                display={formatQty(item.quantity)}
                onSave={(next) => saveField({ quantity: parseFloat(next) })}
              />
              <DetailField
                label={isExternal ? "Total" : "Sell price"}
                value={formatCurrency(item.sell_price, currency)}
              />
              {!isExternal && (
                <>
                  <EditableField
                    label="Unit cost"
                    disabled={fieldsDisabled}
                    mode="number"
                    min={0}
                    value={item.unit_cost}
                    display={formatCurrency(item.unit_cost, currency)}
                    onSave={(next) => saveField({ unitCost: parseFloat(next) })}
                  />
                  <DetailField
                    label="Total cost"
                    value={formatCurrency(item.total_cost, currency)}
                  />
                  <EditableField
                    label="Margin"
                    disabled={fieldsDisabled}
                    mode="number"
                    min={0}
                    max={100}
                    value={item.margin_pct}
                    display={formatPct(item.margin_pct)}
                    valueClassName={marginColor}
                    onSave={(next) =>
                      saveField({ marginPct: parseFloat(next) })
                    }
                  />
                  <EditableField
                    label="Overhead"
                    disabled={fieldsDisabled}
                    mode="number"
                    min={0}
                    max={100}
                    value={item.overhead_pct}
                    display={formatPct(item.overhead_pct)}
                    onSave={(next) =>
                      saveField({ overheadPct: parseFloat(next) })
                    }
                  />
                  <EditableField
                    label="Service charge"
                    disabled={fieldsDisabled}
                    mode="number"
                    min={0}
                    max={100}
                    value={item.service_charge_pct}
                    display={formatPct(item.service_charge_pct)}
                    onSave={(next) =>
                      saveField({ serviceChargePct: parseFloat(next) })
                    }
                  />
                  <EditableField
                    label="Client rate"
                    disabled={fieldsDisabled}
                    mode="number"
                    min={0}
                    value={item.client_rate ?? ""}
                    display={formatOptionalCurrency(item.client_rate, currency)}
                    onSave={(next) =>
                      saveField({ clientRate: parseOptionalNumber(next) })
                    }
                  />
                  <EditableField
                    label="Budget rate"
                    disabled={fieldsDisabled}
                    mode="number"
                    min={0}
                    value={item.budget_rate ?? ""}
                    display={formatOptionalCurrency(item.budget_rate, currency)}
                    onSave={(next) =>
                      saveField({ budgetRate: parseOptionalNumber(next) })
                    }
                  />
                </>
              )}
              <EditableField
                label="Length"
                disabled={fieldsDisabled}
                mode="number"
                min={0}
                value={item.length ?? ""}
                display={item.length ? `${formatQty(item.length)} m` : "—"}
                onSave={(next) => saveDimension("length", next)}
              />
              <EditableField
                label="Breadth"
                disabled={fieldsDisabled}
                mode="number"
                min={0}
                value={item.breadth ?? ""}
                display={item.breadth ? `${formatQty(item.breadth)} m` : "—"}
                onSave={(next) => saveDimension("breadth", next)}
              />
              <EditableField
                label="Height"
                disabled={fieldsDisabled}
                mode="number"
                min={0}
                value={item.height ?? ""}
                display={item.height ? `${formatQty(item.height)} m` : "—"}
                onSave={(next) => saveDimension("height", next)}
              />
            </section>

            {item.element_id && (
              <section className="rounded-lg border border-border-default bg-bg-elevated px-3 py-2 text-xs text-text-muted">
                Linked to library element
                {item.element_archived ? " (archived)" : ""}.
              </section>
            )}

            <section className="flex flex-col gap-2">
              {!isExternal && (
                <label className="flex flex-col gap-1.5">
                  <span className="text-xs font-medium text-text-secondary">
                    Internal notes
                  </span>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    disabled={!canEdit}
                    rows={3}
                    className={NOTES_TEXTAREA_CLS}
                    placeholder="Not shown to the client."
                  />
                </label>
              )}
              {/* External viewers see this read-only; feedback flows through
                  the change-request comment, not by editing this field. */}
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-medium text-text-secondary">
                  {isExternal ? "Notes from the team" : "Client notes"}
                </span>
                <textarea
                  value={clientNotes}
                  onChange={(e) => setClientNotes(e.target.value)}
                  disabled={!canEdit}
                  rows={3}
                  className={NOTES_TEXTAREA_CLS}
                  placeholder={
                    isExternal
                      ? "No notes from the team for this line."
                      : "Shown to the client on this line."
                  }
                />
              </label>
            </section>

            {allowedNext.length > 0 && (
              <section className="flex flex-col gap-2">
                <span className="text-xs font-semibold text-text-secondary uppercase tracking-wide">
                  Lifecycle
                </span>
                <div className="flex flex-wrap gap-2">
                  {allowedNext.map((next) => (
                    <Button
                      key={next}
                      type="button"
                      variant={
                        next === "change_requested" ? "danger" : "secondary"
                      }
                      size="sm"
                      disabled={transitioning !== null}
                      onClick={() => handleTransition(next)}
                    >
                      {transitioning === next
                        ? "Working..."
                        : PHASE_ACTION_LABEL[next]}
                    </Button>
                  ))}
                </div>
              </section>
            )}

            <section className="grid grid-cols-2 gap-3 text-xs text-text-muted">
              <span>Created {new Date(item.created_at).toLocaleString()}</span>
              <span>Updated {new Date(item.updated_at).toLocaleString()}</span>
            </section>
          </SheetBody>

          <SheetFooter className="!justify-between">
            {canEdit && onDelete ? (
              <Button
                type="button"
                variant="danger"
                onClick={() => onDelete(item)}
              >
                <Trash2 className="h-4 w-4" />
                Delete
              </Button>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() => onOpenChange(false)}
              >
                Close
              </Button>
              {canEdit && (
                <Button
                  type="button"
                  onClick={handleSaveNotes}
                  disabled={!notesDirty || savingNotes}
                >
                  {savingNotes ? "Saving..." : "Save notes"}
                </Button>
              )}
            </div>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <BoqChangeRequestDialog
        open={changeRequestOpen}
        onOpenChange={setChangeRequestOpen}
        onSubmit={(comment) => fireTransition("change_requested", comment)}
      />
    </>
  );
}

function DetailField({
  label,
  value,
  valueClassName,
}: {
  label: string;
  value: string;
  valueClassName?: string;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-text-muted">{label}</span>
      <span
        className={`text-sm tabular-nums text-text-primary ${valueClassName ?? ""}`}
      >
        {value}
      </span>
    </div>
  );
}

type EditableFieldProps = {
  label: string;
  valueClassName?: string;
} & Omit<
  React.ComponentProps<typeof BoqEditableCell>,
  "ariaLabel" | "className"
>;

/**
 * Each save fires its own PATCH with the current `item.updated_at`. While a
 * save is in flight, the parent disables every cell (`fieldsDisabled |=
 * savingField`) so a fast user can't blur cell A → click cell B → blur
 * cell B before A's response lands and have B's PATCH go out with a stale
 * token. The user has to wait for the prior save to settle before editing
 * the next cell — no overlapping PATCHes.
 */
function EditableField({
  label,
  valueClassName,
  ...cellProps
}: EditableFieldProps) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-text-muted">{label}</span>
      <BoqEditableCell
        {...cellProps}
        ariaLabel={label}
        className={`text-sm tabular-nums text-text-primary ${valueClassName ?? ""}`}
      />
    </div>
  );
}
