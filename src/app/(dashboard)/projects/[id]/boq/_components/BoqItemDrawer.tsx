"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { AlertTriangle, FileText, History, Trash2 } from "lucide-react";
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
import { cn } from "@/lib/utils";
import type { BoqItemWithComputed, BoqSection, UserRole } from "@/types";
import type { BoqItemPhase } from "@/lib/validations";
import { isExternalViewer } from "@/lib/roles";
import { useBoqMutations } from "@/hooks/useBoqMutations";
import { BoqEditableCell } from "./BoqEditableCell";
import { BoqChangeRequestBanner } from "./BoqChangeRequestBanner";
import { BoqChangeRequestDialog } from "./BoqChangeRequestDialog";
import { BoqItemActivity } from "./BoqItemActivity";
import type { UpdateItemPayload } from "@/lib/api/boq";
import {
  formatCurrency,
  formatLibraryName,
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
  /**
   * Click handler for sibling items inside the Activity tab's bulk-batch
   * popover. Parent should swap the open drawer to the clicked item.
   */
  onOpenOtherItem?: (itemId: string) => void;
}

const ACTION_LABEL: Record<BoqItemPhase, string> = {
  draft: "Move to Draft",
  internal_review: "Submit for Review",
  internal_changes_requested: "Request Changes",
  internally_approved: "Approve",
  sent_to_client: "Send to Client",
  client_reviewing: "Mark Client Reviewing",
  client_changes_requested: "Request Changes",
  client_approved: "Mark Client Approved",
};

/** Clients drop the "Mark Client" prefix — they're the client. */
const CLIENT_ACTION_LABEL: Partial<Record<BoqItemPhase, string>> = {
  client_approved: "Approve",
  client_changes_requested: "Request Changes",
};

function phaseActionLabel(
  target: BoqItemPhase,
  viewerRole: UserRole | null
): string {
  if (viewerRole === "client") {
    return CLIENT_ACTION_LABEL[target] ?? ACTION_LABEL[target];
  }
  return ACTION_LABEL[target];
}

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
  onOpenOtherItem,
}: BoqItemDrawerProps) {
  const t = useTranslations("boq.table");
  const { updateItem, setItemPhase } = useBoqMutations(projectId);
  const isExternal = isExternalViewer(role);
  const [notes, setNotes] = useState("");
  const [clientNotes, setClientNotes] = useState("");
  // True while the close-time notes PATCH is in flight. Drives the "Saving..."
  // label on the Close button and blocks duplicate close attempts.
  const [closing, setClosing] = useState(false);
  // True while ANY inline-edit cell is mid-PATCH. Used to disable the other
  // cells so a fast user can't blur cell A → blur cell B before A returns
  // and have B's PATCH go out with a stale `item.updated_at` (→ 409 + a
  // silently-lost edit).
  const [savingField, setSavingField] = useState(false);
  // Ref mirror of `savingField` — the close handler can't observe React state
  // mid-await, so it polls this ref to wait for the in-flight field PATCH
  // before saving notes with a fresh `updated_at`.
  const savingFieldRef = useRef(false);
  // Always-current `item` snapshot for the close handler. After an awaited
  // field save, the closure's `item` is stale; the ref reflects whatever
  // SWR has just propagated.
  const itemRef = useRef(item);
  itemRef.current = item;
  const [transitioning, setTransitioning] = useState<BoqItemPhase | null>(null);
  // Carries which destructive variant was picked so the dialog submits with
  // the right phase (internal vs client kick-back).
  const [pendingDestructive, setPendingDestructive] =
    useState<BoqItemPhase | null>(null);
  const [tab, setTab] = useState<"details" | "activity">("details");

  // Seed notes only when a new drawer opens — revalidations must not clobber edits.
  // Also reset to Details so opening a different item doesn't keep an
  // unrelated Activity feed in view.
  useEffect(() => {
    if (!open || !item) return;
    setNotes(item.notes ?? "");
    setClientNotes(item.client_notes ?? "");
    setTab("details");
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
        title: `Marked ${phaseToLabel(next, role)}`,
        variant: "success",
      });
    } finally {
      setTransitioning(null);
    }
  };

  const handleTransition = (next: BoqItemPhase) => {
    if (isDestructivePhase(next)) {
      setPendingDestructive(next);
      return;
    }
    void fireTransition(next);
  };

  /**
   * Sheet's single close path. All close intents (Escape, overlay click, X,
   * footer Close button) funnel through here so notes auto-save consistently.
   *
   * - Clean drawer → close immediately.
   * - Dirty notes → block close on a notes PATCH so failures stay visible
   *   while the drawer is still on screen. A 409 (returned as `null` by
   *   `updateItem`) or thrown error keeps the drawer open; the existing
   *   toast inside `useBoqMutations` surfaces the reason.
   * - In-flight field PATCH → wait for it to settle so we save notes with
   *   the fresh `updated_at`, avoiding a self-409.
   */
  const handleSheetOpenChange = async (next: boolean) => {
    if (next) {
      onOpenChange(true);
      return;
    }
    if (closing) return;
    if (!notesDirty) {
      onOpenChange(false);
      return;
    }
    setClosing(true);
    while (savingFieldRef.current) {
      await new Promise((r) => setTimeout(r, 30));
    }
    const current = itemRef.current;
    if (!current) {
      setClosing(false);
      onOpenChange(false);
      return;
    }
    let result: BoqItemWithComputed | null | undefined;
    try {
      result = await updateItem(current.id, {
        updatedAt: current.updated_at,
        notes: notes.trim() || null,
        clientNotes: clientNotes.trim() || null,
      });
    } catch {
      // `updateItem` already toasted; keep drawer open so the user can retry.
      setClosing(false);
      return;
    }
    setClosing(false);
    if (result === null) return; // 409 handled by updateItem; stay open.
    onOpenChange(false);
  };

  const saveField = async (patch: Partial<UpdateItemPayload>) => {
    savingFieldRef.current = true;
    setSavingField(true);
    try {
      await updateItem(item.id, { updatedAt: item.updated_at, ...patch });
    } finally {
      savingFieldRef.current = false;
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
      <Sheet open={open} onOpenChange={handleSheetOpenChange}>
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
                {phaseToLabel(item.phase, role)}
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

          <div
            role="tablist"
            aria-label="Item view"
            className="flex gap-1 px-5 -mt-1 border-b border-border-default"
          >
            <DrawerTab
              icon={FileText}
              label="Details"
              active={tab === "details"}
              onClick={() => setTab("details")}
            />
            <DrawerTab
              icon={History}
              label="Activity"
              active={tab === "activity"}
              onClick={() => setTab("activity")}
            />
          </div>

          <SheetBody
            className={cn(
              "flex flex-col gap-5",
              tab === "activity" && "hidden"
            )}
          >
            {isDestructivePhase(item.phase) && (
              <BoqChangeRequestBanner projectId={projectId} itemId={item.id} />
            )}
            <section className="flex flex-col gap-3">
              {(() => {
                // Per-line name takes priority over the library element's
                // name. Computed once for both `value` (edit buffer) and
                // `display` (read-only render).
                const resolvedName =
                  item.name ??
                  (item.element_name
                    ? formatLibraryName(
                        item.element_name,
                        item.element_archived
                      )
                    : null);
                return (
                  <EditableField
                    label="Name"
                    disabled={fieldsDisabled}
                    value={resolvedName ?? ""}
                    display={resolvedName ?? "—"}
                    onSave={(next) => saveField({ name: next || null })}
                    placeholder="Short, reusable label"
                  />
                );
              })()}
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
                label={isExternal ? t("totalLabel") : t("fieldProposedPrice")}
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
                        isDestructivePhase(next) ? "danger" : "secondary"
                      }
                      size="sm"
                      disabled={transitioning !== null}
                      onClick={() => handleTransition(next)}
                    >
                      {transitioning === next
                        ? "Working..."
                        : phaseActionLabel(next, role)}
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

          {tab === "activity" && (
            <SheetBody className="flex flex-col">
              <BoqItemActivity
                projectId={projectId}
                itemId={item.id}
                viewerRole={role}
                onOpenOtherItem={onOpenOtherItem}
              />
            </SheetBody>
          )}

          <SheetFooter className="!justify-between">
            {canEdit && onDelete ? (
              <Button
                type="button"
                variant="danger"
                disabled={closing}
                onClick={() => onDelete(item)}
              >
                <Trash2 className="h-4 w-4" />
                Delete
              </Button>
            ) : (
              <span />
            )}
            <Button
              type="button"
              variant="secondary"
              disabled={closing}
              onClick={() => handleSheetOpenChange(false)}
            >
              {closing ? "Saving..." : "Close"}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <BoqChangeRequestDialog
        open={pendingDestructive !== null}
        onOpenChange={(next) => {
          if (!next) setPendingDestructive(null);
        }}
        onSubmit={(comment) => {
          if (pendingDestructive) {
            void fireTransition(pendingDestructive, comment);
          }
          setPendingDestructive(null);
        }}
      />
    </>
  );
}

function DrawerTab({
  icon: Icon,
  label,
  active,
  onClick,
}: {
  icon: React.ElementType;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-2 px-5 py-3.5 text-sm font-semibold border-b-[3px] -mb-px transition-colors cursor-pointer",
        active
          ? "border-accent text-text-primary"
          : "border-transparent text-text-muted hover:text-text-secondary"
      )}
    >
      <Icon className="w-4 h-4" />
      {label}
    </button>
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
