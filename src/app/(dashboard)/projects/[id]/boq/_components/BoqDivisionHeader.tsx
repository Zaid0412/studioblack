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
  sectionCount,
  divisionTotal,
  currency,
}: {
  name: string;
  sectionCount: number;
  divisionTotal: number;
  currency: string;
}) {
  return (
    <div className="flex items-center gap-2 border-y border-border-default bg-bg-elevated px-3 py-2">
      <Layers className="h-4 w-4 text-text-secondary" />
      <span className="text-xs font-bold uppercase tracking-wide text-text-primary">
        {name}
      </span>
      <span className="text-[11px] text-text-muted">
        {sectionCount === 1 ? "1 section" : `${sectionCount} sections`}
      </span>
      <span className="ml-auto text-xs font-semibold text-text-secondary">
        {formatCurrency(divisionTotal, currency)}
      </span>
    </div>
  );
}
