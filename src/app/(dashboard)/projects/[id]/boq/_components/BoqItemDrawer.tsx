"use client";

import { useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";
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
import type { BoqItemWithComputed, BoqSection } from "@/types";
import type { BoqItemLifecycleStatus } from "@/lib/validations";
import { useBoqMutations } from "@/hooks/useBoqMutations";
import { BoqEditableCell } from "./BoqEditableCell";
import type { UpdateItemPayload } from "@/lib/api/boq";
import {
  clientApprovalToVariant,
  formatCurrency,
  formatPct,
  formatQty,
  lifecycleToVariant,
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
}

/** Transitions allowed from each current lifecycle state. Keeps the UI honest. */
const LIFECYCLE_TRANSITIONS: Record<
  BoqItemLifecycleStatus,
  BoqItemLifecycleStatus[]
> = {
  draft: ["submitted"],
  submitted: ["approved", "rejected", "queried", "draft"],
  queried: ["submitted", "rejected", "draft"],
  approved: ["locked", "queried"],
  rejected: ["draft"],
  locked: [],
  change_order_pending: ["approved", "rejected"],
  superseded: [],
};

const TRANSITION_LABEL: Record<BoqItemLifecycleStatus, string> = {
  draft: "Move to draft",
  submitted: "Submit",
  approved: "Approve",
  rejected: "Reject",
  queried: "Query",
  locked: "Lock",
  change_order_pending: "Change-order pending",
  superseded: "Superseded",
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
}: BoqItemDrawerProps) {
  const { updateItem } = useBoqMutations(projectId);
  const [notes, setNotes] = useState("");
  const [clientNotes, setClientNotes] = useState("");
  const [savingNotes, setSavingNotes] = useState(false);
  const [transitioning, setTransitioning] =
    useState<BoqItemLifecycleStatus | null>(null);

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
  const rowLocked =
    item.lifecycle_status === "locked" ||
    item.lifecycle_status === "superseded";
  const notesDirty =
    (notes ?? "") !== (item.notes ?? "") ||
    (clientNotes ?? "") !== (item.client_notes ?? "");

  const handleTransition = async (next: BoqItemLifecycleStatus) => {
    setTransitioning(next);
    try {
      const updated = await updateItem(item.id, {
        updatedAt: item.updated_at,
        lifecycleStatus: next,
      });
      if (updated) {
        toast({
          title: `Marked ${next.replace(/_/g, " ")}`,
          variant: "success",
        });
      }
    } finally {
      setTransitioning(null);
    }
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

  // Single-field save used by every inline editor below. Each cell fires its
  // own PATCH on blur with the current `item.updated_at`; SWR replaces the row
  // on success so the next field's save sees a fresh token.
  const saveField = async (patch: Partial<UpdateItemPayload>) => {
    await updateItem(item.id, { updatedAt: item.updated_at, ...patch });
  };

  const fieldsDisabled = !canEdit || rowLocked;

  const allowedNext = LIFECYCLE_TRANSITIONS[item.lifecycle_status] ?? [];

  return (
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
            <Badge variant={lifecycleToVariant(item.lifecycle_status)}>
              {item.lifecycle_status.replace(/_/g, " ")}
            </Badge>
            <Badge
              variant={clientApprovalToVariant(item.client_approval_status)}
            >
              client: {item.client_approval_status}
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
          </div>
        </SheetHeader>

        <SheetBody className="flex flex-col gap-5">
          {/* Description + identifier — separate from the metrics grid because
            * description is multi-line and the others sit on a tabular grid. */}
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
              align="right"
              mode="number"
              min={0}
              value={item.quantity}
              display={formatQty(item.quantity)}
              onSave={(next) => saveField({ quantity: parseFloat(next) })}
            />
            <EditableField
              label="Unit cost"
              disabled={fieldsDisabled}
              align="right"
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
            <DetailField
              label="Sell price"
              value={formatCurrency(item.sell_price, currency)}
            />
            <EditableField
              label="Margin"
              disabled={fieldsDisabled}
              align="right"
              mode="number"
              min={0}
              max={100}
              value={item.margin_pct}
              display={formatPct(item.margin_pct)}
              valueClassName={marginColor}
              onSave={(next) => saveField({ marginPct: parseFloat(next) })}
            />
            <EditableField
              label="Overhead"
              disabled={fieldsDisabled}
              align="right"
              mode="number"
              min={0}
              max={100}
              value={item.overhead_pct}
              display={formatPct(item.overhead_pct)}
              onSave={(next) => saveField({ overheadPct: parseFloat(next) })}
            />
            <EditableField
              label="Service charge"
              disabled={fieldsDisabled}
              align="right"
              mode="number"
              min={0}
              max={100}
              value={item.service_charge_pct}
              display={formatPct(item.service_charge_pct)}
              onSave={(next) =>
                saveField({ serviceChargePct: parseFloat(next) })
              }
            />
          </section>

          {item.element_id && (
            <section className="rounded-lg border border-border-default bg-bg-elevated px-3 py-2 text-xs text-text-muted">
              Linked to library element
              {item.element_archived ? " (archived)" : ""}.
            </section>
          )}

          <section className="flex flex-col gap-2">
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-text-secondary">
                Internal notes
              </span>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                disabled={!canEdit || rowLocked}
                rows={3}
                className={NOTES_TEXTAREA_CLS}
                placeholder="Not shown to the client."
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-text-secondary">
                Client notes
              </span>
              <textarea
                value={clientNotes}
                onChange={(e) => setClientNotes(e.target.value)}
                disabled={!canEdit || rowLocked}
                rows={3}
                className={NOTES_TEXTAREA_CLS}
                placeholder="Shown to the client on this line."
              />
            </label>
          </section>

          {canEdit && !rowLocked && allowedNext.length > 0 && (
            <section className="flex flex-col gap-2">
              <span className="text-xs font-semibold text-text-secondary uppercase tracking-wide">
                Lifecycle
              </span>
              <div className="flex flex-wrap gap-2">
                {allowedNext.map((next) => (
                  <Button
                    key={next}
                    type="button"
                    variant={next === "rejected" ? "danger" : "secondary"}
                    size="sm"
                    disabled={transitioning !== null}
                    onClick={() => handleTransition(next)}
                  >
                    {transitioning === next
                      ? "Working..."
                      : TRANSITION_LABEL[next]}
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

        <SheetFooter>
          <Button
            type="button"
            variant="secondary"
            onClick={() => onOpenChange(false)}
          >
            Close
          </Button>
          {canEdit && !rowLocked && (
            <Button
              type="button"
              onClick={handleSaveNotes}
              disabled={!notesDirty || savingNotes}
            >
              {savingNotes ? "Saving..." : "Save notes"}
            </Button>
          )}
        </SheetFooter>
      </SheetContent>
    </Sheet>
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

interface EditableFieldProps {
  label: string;
  /** Underlying value seeded into the input. */
  value: string | number;
  /** Formatted value rendered when not editing. */
  display: string;
  onSave: (next: string) => Promise<void> | void;
  disabled?: boolean;
  mode?: "text" | "number";
  align?: "left" | "right";
  min?: number;
  max?: number;
  valueClassName?: string;
  inputClassName?: string;
}

/**
 * Drawer wrapper around `BoqEditableCell` — adds a label above the cell and
 * lets the calling site stay declarative. Each save fires an independent
 * PATCH using the current `item.updated_at`; SWR replaces the row before the
 * next field's save runs.
 */
function EditableField({
  label,
  value,
  display,
  onSave,
  disabled,
  mode = "text",
  align = "left",
  min,
  max,
  valueClassName,
  inputClassName,
}: EditableFieldProps) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-text-muted">{label}</span>
      <BoqEditableCell
        value={value}
        display={display}
        mode={mode}
        align={align}
        min={min}
        max={max}
        disabled={disabled}
        onSave={onSave}
        ariaLabel={label}
        className={`text-sm tabular-nums text-text-primary ${valueClassName ?? ""}`}
        inputClassName={inputClassName}
      />
    </div>
  );
}
