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
   * Best matching active rate per element id (RFQ-create only). When provided
   * together with `onUseContract`, a "rate contract available" column renders
   * with a one-click "Use contract" action.
   */
  rateAvailability?: Record<string, AvailableRate | null>;
  onUseContract?: (item: BoqItemWithComputed) => void;
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
  rateAvailability,
  onUseContract,
}: Props) {
  const allSelected = items.length > 0 && selected.size === items.length;
  const someSelected = selected.size > 0 && selected.size < items.length;
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
          const rate =
            showRates && it.element_id
              ? (rateAvailability?.[it.element_id] ?? null)
              : null;
          return (
            <tr
              key={it.id}
              data-anim-item
              className="border-t border-border-default hover:bg-bg-elevated/30 cursor-pointer"
              onClick={() => onToggleItem(it.id)}
            >
              <td className="px-4 py-3">
                <span
                  onClick={(e) => e.stopPropagation()}
                  className="inline-flex"
                >
                  <Checkbox
                    checked={selected.has(it.id)}
                    onCheckedChange={() => onToggleItem(it.id)}
                    aria-label={it.description}
                  />
                </span>
              </td>
              <td className="px-4 py-3 font-mono text-xs text-text-muted">
                {it.item_code}
              </td>
              <td className="px-4 py-3 text-text-primary">{it.description}</td>
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
