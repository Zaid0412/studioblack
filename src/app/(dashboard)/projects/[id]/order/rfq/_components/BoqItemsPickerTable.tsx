"use client";

import { BadgeCheck } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/formatCurrency";
import { useStaggerReveal } from "@/hooks/useStaggerReveal";
import type { AvailableRate, BoqItemWithComputed } from "@/types";

interface Labels {
  selectAll: string;
  code: string;
  description: string;
  unit: string;
  quantity: string;
  /** RFQ-create only — header + action for the rate-contract column. */
  rateContract?: string;
  useContract?: string;
}

interface Props {
  items: ReadonlyArray<BoqItemWithComputed>;
  selected: ReadonlySet<string>;
  onToggleItem: (id: string) => void;
  onToggleAll: () => void;
  labels: Labels;
  /**
   * Reason each non-selectable row is disabled, keyed by item id (absent → the
   * row is selectable). Disabled rows still render — greyed out with the reason
   * — so an item already committed to procurement doesn't silently disappear.
   */
  disabledReasons?: Record<string, string>;
  /**
   * Best matching active rate per element id (RFQ-create only). When provided
   * together with `onUseContract`, a "rate contract available" column renders
   * with a one-click "Use contract" action.
   */
  rateAvailability?: Record<string, AvailableRate | null>;
  onUseContract?: (item: BoqItemWithComputed) => void;
}

/**
 * Soft, per-status tint for a disabled row's reason pill — very light fills so
 * the badges read as a quiet hint, not a loud status. Keyed by `po_status`;
 * unknown statuses fall back to neutral.
 */
const DISABLED_TONE: Record<string, string> = {
  rfq_issued: "bg-info/10 text-info border-info/20",
  quoted: "bg-warning/10 text-warning border-warning/20",
  po_raised: "bg-accent/10 text-accent border-accent/20",
  delivered: "bg-success/10 text-success border-success/20",
};
const NEUTRAL_TONE = "bg-bg-elevated text-text-muted border-border-default";

/**
 * Shared "pick BOQ items" table used by the RFQ create form and the
 * "add items to existing RFQ" dialog. Indeterminate-aware select-all
 * header plus the canonical code / description / unit / quantity columns.
 */
export function BoqItemsPickerTable({
  items,
  selected,
  onToggleItem,
  onToggleAll,
  labels,
  disabledReasons,
  rateAvailability,
  onUseContract,
}: Props) {
  // Select-all reflects only the selectable rows — disabled ones can't be picked.
  const selectableCount = disabledReasons
    ? items.filter((it) => !disabledReasons[it.id]).length
    : items.length;
  const allSelected = selectableCount > 0 && selected.size === selectableCount;
  const someSelected = selected.size > 0 && selected.size < selectableCount;
  const showRates = !!rateAvailability && !!onUseContract;

  // Cascade the rows in on mount / when the item set changes.
  const bodyRef = useStaggerReveal<HTMLTableSectionElement>(
    items.map((it) => it.id).join(",")
  );

  return (
    <table className="w-full text-sm">
      <thead className="bg-bg-elevated text-text-muted sticky top-0">
        <tr className="text-left">
          <th className="px-4 py-2.5 w-10">
            <Checkbox
              checked={allSelected}
              indeterminate={someSelected}
              onCheckedChange={onToggleAll}
              aria-label={labels.selectAll}
            />
          </th>
          <th className="px-4 py-2.5 font-medium">{labels.code}</th>
          <th className="px-4 py-2.5 font-medium">{labels.description}</th>
          <th className="px-4 py-2.5 font-medium">{labels.unit}</th>
          <th className="px-4 py-2.5 font-medium text-right">
            {labels.quantity}
          </th>
          {showRates && (
            <th className="px-4 py-2.5 font-medium">{labels.rateContract}</th>
          )}
        </tr>
      </thead>
      <tbody ref={bodyRef}>
        {items.map((it) => {
          const reason = disabledReasons?.[it.id];
          const disabled = !!reason;
          const rate =
            !disabled && showRates && it.element_id
              ? (rateAvailability?.[it.element_id] ?? null)
              : null;
          return (
            <tr
              key={it.id}
              data-anim-item
              className={`border-t border-border-default ${
                disabled
                  ? "opacity-60"
                  : "hover:bg-bg-elevated/30 cursor-pointer"
              }`}
              onClick={disabled ? undefined : () => onToggleItem(it.id)}
            >
              <td className="px-4 py-3">
                <span
                  onClick={(e) => e.stopPropagation()}
                  className="inline-flex"
                >
                  <Checkbox
                    checked={selected.has(it.id)}
                    onCheckedChange={() => !disabled && onToggleItem(it.id)}
                    disabled={disabled}
                    aria-label={it.description}
                  />
                </span>
              </td>
              <td className="px-4 py-3 font-mono text-xs text-text-muted">
                {it.item_code}
              </td>
              <td className="px-4 py-3 text-text-primary">
                <span className="inline-flex items-center gap-2">
                  <span className={disabled ? "text-text-muted" : ""}>
                    {it.description}
                  </span>
                  {reason && (
                    <span
                      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] whitespace-nowrap ${
                        DISABLED_TONE[it.po_status] ?? NEUTRAL_TONE
                      }`}
                    >
                      {reason}
                    </span>
                  )}
                </span>
              </td>
              <td className="px-4 py-3 text-text-secondary">{it.unit}</td>
              <td className="px-4 py-3 text-right tabular-nums text-text-secondary">
                {it.quantity}
              </td>
              {showRates && (
                <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                  {rate ? (
                    <div className="flex items-center gap-2.5">
                      <span className="inline-flex items-center gap-1.5 text-xs text-text-secondary">
                        <BadgeCheck className="w-3.5 h-3.5 text-success shrink-0" />
                        <span className="truncate max-w-[180px]">
                          {rate.vendor_name} ·{" "}
                          {formatCurrency(rate.rate, rate.currency)}/{rate.unit}
                        </span>
                      </span>
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() => onUseContract?.(it)}
                      >
                        {labels.useContract}
                      </Button>
                    </div>
                  ) : (
                    <span className="text-xs text-text-muted">—</span>
                  )}
                </td>
              )}
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
