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
   * For each non-selectable row (keyed by item id; absent → selectable): the
   * pill `label` and its `tone` (colour classes). Disabled rows still render —
   * greyed out with the pill — so a row the caller can't pick doesn't silently
   * disappear. The caller owns label + tone, so this table stays free of any
   * workflow-specific styling.
   */
  disabledReasons?: Record<string, { label: string; tone: string }>;
  /**
   * Best matching active rate per element id (RFQ-create only). When provided
   * together with `onUseContract`, a "rate contract available" column renders
   * with a one-click "Use contract" action.
   */
  rateAvailability?: Record<string, AvailableRate | null>;
  onUseContract?: (item: BoqItemWithComputed) => void;
  /**
   * Row entrance cascade. Off for callers that render the table inside a
   * fixed-height scroll box (the add-items dialog): the reveal's `translateY`
   * briefly extends the scroll area on a near-full list and flashes a
   * scrollbar on open. Defaults on for the create form, which isn't clipped.
   */
  animateRows?: boolean;
}

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
  animateRows = true,
}: Props) {
  // Select-all reflects only the selectable rows that are currently shown —
  // disabled ones can't be picked, and counting *visible* selected rows keeps
  // the header correct when the caller filters the list (search) while
  // selections persist off-filter.
  const selectableItems = disabledReasons
    ? items.filter((it) => !disabledReasons[it.id])
    : items;
  const selectedVisible = selectableItems.reduce(
    (n, it) => (selected.has(it.id) ? n + 1 : n),
    0
  );
  const allSelected =
    selectableItems.length > 0 && selectedVisible === selectableItems.length;
  const someSelected =
    selectedVisible > 0 && selectedVisible < selectableItems.length;
  const showRates = !!rateAvailability && !!onUseContract;

  // Cascade the rows in on mount / when the item set changes.
  const bodyRef = useStaggerReveal<HTMLTableSectionElement>(
    items.map((it) => it.id).join(","),
    animateRows
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
          const pill = disabledReasons?.[it.id];
          const disabled = !!pill;
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
                  {pill && (
                    <span
                      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] whitespace-nowrap ${pill.tone}`}
                    >
                      {pill.label}
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
