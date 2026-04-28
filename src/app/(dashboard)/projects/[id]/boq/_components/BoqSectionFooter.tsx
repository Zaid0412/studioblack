"use client";

import { formatCurrency } from "../_lib/formatters";

interface BoqSectionFooterProps {
  itemCount: number;
  sectionTotal: number;
  currency: string;
  label?: string;
}

/** Per-section totals row rendered at the bottom of an expanded section. */
export function BoqSectionFooter({
  itemCount,
  sectionTotal,
  currency,
  label = "Section total",
}: BoqSectionFooterProps) {
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-2 bg-bg-elevated/50 border-b border-border-default text-xs">
      <span className="text-text-muted">
        {itemCount} item{itemCount === 1 ? "" : "s"}
      </span>
      <span className="text-text-primary font-semibold tabular-nums">
        {label}: {formatCurrency(sectionTotal, currency)}
      </span>
    </div>
  );
}
