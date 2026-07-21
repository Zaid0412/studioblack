"use client";

import { Layers } from "lucide-react";
import { formatCurrency } from "../_lib/formatters";

/**
 * A division band spanning the sections beneath it — the top grouping level
 * (Division → Section → line items). Visual only: sections are assigned to a
 * division via the section editor, not by dragging onto this band.
 */
export function BoqDivisionHeader({
  name,
  itemCount,
  divisionTotal,
  currency,
}: {
  name: string;
  itemCount: number;
  divisionTotal: number;
  currency: string;
}) {
  return (
    <div className="flex items-center gap-2 border-y border-border-default bg-bg-elevated pl-3 py-2">
      <Layers className="h-4 w-4 shrink-0 text-text-secondary" />
      <span className="text-xs font-bold uppercase tracking-wide text-text-primary whitespace-nowrap">
        {name}
      </span>
      <span className="text-[11px] text-text-muted whitespace-nowrap">
        {itemCount === 1 ? "1 item" : `${itemCount} items`}
      </span>
      {/* Pinned to the visible right edge so it survives horizontal scroll. */}
      <span className="sticky right-0 ml-auto flex items-center bg-bg-elevated pl-4 pr-4 border-l border-border-default shadow-[-6px_0_6px_-6px_rgba(0,0,0,0.12)] text-xs font-semibold text-text-secondary tabular-nums whitespace-nowrap">
        {formatCurrency(divisionTotal, currency)}
      </span>
    </div>
  );
}
