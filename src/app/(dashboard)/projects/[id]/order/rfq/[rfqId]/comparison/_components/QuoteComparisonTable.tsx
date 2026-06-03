"use client";

import { Star } from "lucide-react";
import { QuoteStatusBadge } from "@/components/rfq/QuoteStatusBadge";
import { formatDate } from "@/lib/formatDate";
import type { QuoteComparison } from "@/types";

interface Props {
  comparison: QuoteComparison;
}

/**
 * Side-by-side quote comparison. Each RFQ item is a row; each vendor a
 * column. Lowest-price cells are highlighted; expired vendor columns
 * are dimmed. Footer shows grand totals per vendor.
 */
export function QuoteComparisonTable({ comparison }: Props) {
  if (comparison.vendors.length === 0) {
    return (
      <div className="rounded-xl border border-border-default bg-bg-secondary p-10 text-center">
        <p className="text-sm text-text-secondary">
          No quotes have been submitted yet.
        </p>
        <p className="text-xs text-text-muted mt-1">
          Vendors invited to this RFQ can submit quotes from their portal.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border-default bg-bg-secondary overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm border-collapse">
          <thead className="bg-bg-elevated">
            <tr>
              <th className="sticky left-0 z-10 bg-bg-elevated text-left px-4 py-3 font-medium text-text-muted border-r border-border-default min-w-[240px]">
                Item
              </th>
              <th className="text-left px-3 py-3 font-medium text-text-muted">
                Qty / Unit
              </th>
              {comparison.vendors.map((v) => (
                <th
                  key={v.vendor_id}
                  className={`text-right px-4 py-3 font-medium border-l border-border-default min-w-[160px] ${
                    v.quote_status === "expired"
                      ? "text-text-muted opacity-60"
                      : "text-text-primary"
                  }`}
                >
                  <div className="flex flex-col items-end gap-1">
                    <span className="text-text-primary">{v.vendor_name}</span>
                    <div className="flex items-center gap-1.5">
                      <QuoteStatusBadge status={v.quote_status} />
                      {v.is_late && (
                        <span className="text-[10px] font-medium text-warning bg-warning/10 px-1 py-0.5 rounded">
                          Late
                        </span>
                      )}
                    </div>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {comparison.items.map((row) => (
              <tr
                key={row.rfq_item_id}
                className="border-t border-border-default"
              >
                <td className="sticky left-0 bg-bg-secondary px-4 py-3 border-r border-border-default align-top">
                  <div className="text-text-primary">{row.description}</div>
                  {row.spec_notes && (
                    <div className="text-xs text-text-muted mt-0.5">
                      {row.spec_notes}
                    </div>
                  )}
                </td>
                <td className="px-3 py-3 text-text-secondary tabular-nums whitespace-nowrap align-top">
                  {row.quantity} {row.unit}
                </td>
                {comparison.vendors.map((v) => {
                  const line = row.vendor_prices[v.vendor_id];
                  const dim = v.quote_status === "expired";
                  if (!line) {
                    return (
                      <td
                        key={v.vendor_id}
                        className="px-4 py-3 text-right text-text-muted border-l border-border-default"
                      >
                        —
                      </td>
                    );
                  }
                  return (
                    <td
                      key={v.vendor_id}
                      className={`px-4 py-3 text-right tabular-nums border-l border-border-default align-top ${
                        dim ? "opacity-60" : ""
                      } ${
                        line.is_lowest && !dim
                          ? "bg-status-approved-arch/5 border-l-status-approved-arch/30"
                          : ""
                      }`}
                    >
                      <div className="flex items-center justify-end gap-1.5">
                        {line.is_lowest && !dim && (
                          <Star className="w-3 h-3 text-status-approved-arch fill-status-approved-arch" />
                        )}
                        <span className="text-text-primary">
                          {line.unit_price.toLocaleString(undefined, {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </span>
                      </div>
                      <div className="text-xs text-text-muted mt-0.5">
                        ={" "}
                        {line.line_total.toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </div>
                      {line.notes && (
                        <div
                          className="text-xs text-text-muted mt-1 max-w-[160px] truncate"
                          title={line.notes}
                        >
                          {line.notes}
                        </div>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-border-default bg-bg-elevated">
              <td
                colSpan={2}
                className="sticky left-0 bg-bg-elevated px-4 py-3 text-right font-semibold text-text-primary border-r border-border-default"
              >
                Grand total
              </td>
              {comparison.vendors.map((v) => (
                <td
                  key={v.vendor_id}
                  className={`px-4 py-3 text-right tabular-nums border-l border-border-default font-semibold ${
                    v.quote_status === "expired"
                      ? "opacity-60 text-text-muted"
                      : "text-text-primary"
                  }`}
                >
                  {v.grand_total.toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}{" "}
                  <span className="text-xs text-text-muted">{v.currency}</span>
                </td>
              ))}
            </tr>
            <tr className="bg-bg-elevated text-xs text-text-muted">
              <td
                colSpan={2}
                className="sticky left-0 bg-bg-elevated px-4 py-2 text-right border-r border-border-default"
              >
                Delivery
              </td>
              {comparison.vendors.map((v) => (
                <td
                  key={v.vendor_id}
                  className="px-4 py-2 text-right border-l border-border-default"
                >
                  {v.delivery_period ?? "—"}
                </td>
              ))}
            </tr>
            <tr className="bg-bg-elevated text-xs text-text-muted">
              <td
                colSpan={2}
                className="sticky left-0 bg-bg-elevated px-4 py-2 text-right border-r border-border-default"
              >
                Payment terms
              </td>
              {comparison.vendors.map((v) => (
                <td
                  key={v.vendor_id}
                  className="px-4 py-2 text-right border-l border-border-default"
                >
                  {v.payment_terms ?? "—"}
                </td>
              ))}
            </tr>
            <tr className="bg-bg-elevated text-xs text-text-muted">
              <td
                colSpan={2}
                className="sticky left-0 bg-bg-elevated px-4 py-2 text-right border-r border-border-default"
              >
                Valid until
              </td>
              {comparison.vendors.map((v) => (
                <td
                  key={v.vendor_id}
                  className="px-4 py-2 text-right border-l border-border-default"
                >
                  {v.valid_until ? formatDate(v.valid_until) : "—"}
                </td>
              ))}
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
