"use client";

import type { ReactNode } from "react";
import { Star } from "lucide-react";
import { QuoteStatusBadge } from "@/components/rfq/QuoteStatusBadge";
import { ResponseSourceBadge } from "@/components/rfq/ResponseSourceBadge";
import { formatDate } from "@/lib/formatDate";
import { isInactiveQuote } from "@/lib/validations";
import type { QuoteComparison, QuoteComparisonVendorColumn } from "@/types";

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
              <th className="text-right px-3 py-3 font-medium text-text-muted whitespace-nowrap">
                Proposed
              </th>
              {comparison.vendors.map((v) => {
                const quotedCount = comparison.items.filter(
                  (r) => r.vendor_prices[v.vendor_id]
                ).length;
                return (
                  <th
                    key={v.vendor_id}
                    className={`text-right px-4 py-3 font-medium border-l border-border-default min-w-[160px] ${
                      isInactiveQuote(v.quote_status)
                        ? "text-text-muted opacity-60"
                        : "text-text-primary"
                    }`}
                  >
                    <div className="flex flex-col items-end gap-1">
                      <span className="text-text-primary">{v.vendor_name}</span>
                      <div className="flex items-center gap-1.5">
                        <QuoteStatusBadge status={v.quote_status} />
                        <ResponseSourceBadge source={v.response_source} />
                        {v.is_late && (
                          <span className="text-[10px] font-medium text-warning bg-warning/10 px-1 py-0.5 rounded">
                            Late
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] font-normal text-text-muted">
                        {quotedCount}/{comparison.items.length} items quoted
                      </span>
                    </div>
                  </th>
                );
              })}
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
                <td className="px-3 py-3 text-right text-text-muted tabular-nums whitespace-nowrap align-top">
                  {row.proposed_price === null
                    ? "—"
                    : row.proposed_price.toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                </td>
                {comparison.vendors.map((v) => {
                  const line = row.vendor_prices[v.vendor_id];
                  const dim = isInactiveQuote(v.quote_status);
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
                colSpan={3}
                className="sticky left-0 bg-bg-elevated px-4 py-3 text-right font-semibold text-text-primary border-r border-border-default"
              >
                Grand total
              </td>
              {comparison.vendors.map((v) => (
                <td
                  key={v.vendor_id}
                  className={`px-4 py-3 text-right tabular-nums border-l border-border-default font-semibold ${
                    isInactiveQuote(v.quote_status)
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
            <FooterRow
              label="Rating"
              vendors={comparison.vendors}
              render={(v) =>
                v.vendor_rating === null ? (
                  "—"
                ) : (
                  <span className="inline-flex items-center justify-end gap-0.5">
                    <Star className="w-3 h-3 text-warning fill-warning" />
                    {v.vendor_rating.toFixed(1)}
                  </span>
                )
              }
            />
            <FooterRow
              label="Prior awards"
              vendors={comparison.vendors}
              render={(v) => v.vendor_prior_awards}
            />
            <FooterRow
              label="Delivery"
              vendors={comparison.vendors}
              render={(v) => v.delivery_period ?? "—"}
            />
            <FooterRow
              label="Payment terms"
              vendors={comparison.vendors}
              render={(v) => v.payment_terms ?? "—"}
            />
            <FooterRow
              label="Valid until"
              vendors={comparison.vendors}
              render={(v) => (v.valid_until ? formatDate(v.valid_until) : "—")}
            />
          </tfoot>
        </table>
      </div>
    </div>
  );
}

/**
 * One per-vendor summary row in the comparison footer: a sticky label cell
 * spanning the fixed columns, then a right-aligned cell per vendor rendered
 * by `render`. Keeps the repeated row scaffold in one place.
 */
function FooterRow({
  label,
  vendors,
  render,
}: {
  label: string;
  vendors: QuoteComparisonVendorColumn[];
  render: (v: QuoteComparisonVendorColumn) => ReactNode;
}) {
  return (
    <tr className="bg-bg-elevated text-xs text-text-muted">
      <td
        colSpan={3}
        className="sticky left-0 bg-bg-elevated px-4 py-2 text-right border-r border-border-default"
      >
        {label}
      </td>
      {vendors.map((v) => (
        <td
          key={v.vendor_id}
          className="px-4 py-2 text-right border-l border-border-default"
        >
          {render(v)}
        </td>
      ))}
    </tr>
  );
}
