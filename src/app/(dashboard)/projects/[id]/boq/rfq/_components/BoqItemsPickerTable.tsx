"use client";

import { Checkbox } from "@/components/ui/checkbox";
import type { BoqItemWithComputed } from "@/types";

interface Labels {
  selectAll: string;
  code: string;
  description: string;
  unit: string;
  quantity: string;
}

interface Props {
  items: ReadonlyArray<BoqItemWithComputed>;
  selected: ReadonlySet<string>;
  onToggleItem: (id: string) => void;
  onToggleAll: () => void;
  labels: Labels;
}

/**
 * Shared "pick BOQ items" table used by the RFQ create form and the
 * "add items to existing RFQ" dialog. Renders a checkbox column with an
 * indeterminate-aware select-all header plus the canonical code /
 * description / unit / quantity columns.
 *
 * Row clicks toggle selection; the checkbox click is stopped from
 * propagating so it doesn't double-toggle via the row handler.
 */
export function BoqItemsPickerTable({
  items,
  selected,
  onToggleItem,
  onToggleAll,
  labels,
}: Props) {
  const allSelected = items.length > 0 && selected.size === items.length;
  const someSelected = selected.size > 0 && selected.size < items.length;

  return (
    <table className="w-full text-sm">
      <thead className="bg-bg-elevated text-text-muted sticky top-0">
        <tr className="text-left">
          <th className="px-4 py-2.5 w-10">
            <span onClick={(e) => e.stopPropagation()} className="inline-flex">
              <Checkbox
                checked={allSelected}
                indeterminate={someSelected}
                onCheckedChange={onToggleAll}
                aria-label={labels.selectAll}
              />
            </span>
          </th>
          <th className="px-4 py-2.5 font-medium">{labels.code}</th>
          <th className="px-4 py-2.5 font-medium">{labels.description}</th>
          <th className="px-4 py-2.5 font-medium">{labels.unit}</th>
          <th className="px-4 py-2.5 font-medium text-right">
            {labels.quantity}
          </th>
        </tr>
      </thead>
      <tbody>
        {items.map((it) => (
          <tr
            key={it.id}
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
          </tr>
        ))}
      </tbody>
    </table>
  );
}
