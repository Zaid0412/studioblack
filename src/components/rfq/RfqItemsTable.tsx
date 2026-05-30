"use client";

import type { ReactNode } from "react";

interface RfqItemRow {
  id: string;
  description: string;
  unit: string;
  quantity: string | number;
  spec_notes: string | null;
}

interface Labels {
  description: string;
  unit: string;
  quantity: string;
  specNotes: string;
}

interface Props {
  items: ReadonlyArray<RfqItemRow>;
  labels: Labels;
  /**
   * Optional trailing actions column (e.g. PM-only "remove item" button).
   * When omitted, the column is not rendered at all — keeps the table
   * symmetric for read-only audiences (vendor portal).
   */
  renderActions?: (item: RfqItemRow) => ReactNode;
}

/**
 * Read-only RFQ items table. Used on both the PM detail page and the
 * vendor portal detail page; the PM page adds a "remove" action column
 * via `renderActions`.
 */
export function RfqItemsTable({ items, labels, renderActions }: Props) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-bg-elevated text-text-muted">
          <tr className="text-left">
            <th className="px-4 py-2.5 font-medium">{labels.description}</th>
            <th className="px-4 py-2.5 font-medium">{labels.unit}</th>
            <th className="px-4 py-2.5 font-medium text-right">
              {labels.quantity}
            </th>
            <th className="px-4 py-2.5 font-medium">{labels.specNotes}</th>
            {renderActions && <th className="px-4 py-2.5 w-10" />}
          </tr>
        </thead>
        <tbody>
          {items.map((it) => (
            <tr key={it.id} className="border-t border-border-default">
              <td className="px-4 py-3 text-text-primary">{it.description}</td>
              <td className="px-4 py-3 text-text-secondary">{it.unit}</td>
              <td className="px-4 py-3 text-right tabular-nums text-text-secondary">
                {it.quantity}
              </td>
              <td className="px-4 py-3 text-text-muted">
                {it.spec_notes ?? "—"}
              </td>
              {renderActions && (
                <td className="px-4 py-3 text-right">{renderActions(it)}</td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
