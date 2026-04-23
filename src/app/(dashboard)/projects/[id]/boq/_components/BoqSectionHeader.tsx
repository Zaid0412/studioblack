"use client";

import { ChevronDown, ChevronRight } from "lucide-react";
import { formatCurrency } from "../_lib/formatters";

interface BoqSectionHeaderProps {
  title: string;
  itemCount: number;
  sectionTotal: number;
  currency: string;
  collapsed: boolean;
  onToggle: () => void;
  visibleToClient?: boolean;
}

export function BoqSectionHeader({
  title,
  itemCount,
  sectionTotal,
  currency,
  collapsed,
  onToggle,
  visibleToClient,
}: BoqSectionHeaderProps) {
  const Chevron = collapsed ? ChevronRight : ChevronDown;
  return (
    <button
      type="button"
      onClick={onToggle}
      className="w-full flex items-center gap-3 px-4 py-3 bg-bg-elevated border-b border-border-default text-left hover:bg-bg-elevated/80 transition-colors"
    >
      <Chevron className="w-4 h-4 text-text-muted flex-shrink-0" />
      <span className="text-sm font-semibold text-text-primary flex-1 truncate">
        {title}
      </span>
      <span className="text-xs text-text-muted">
        {itemCount} item{itemCount === 1 ? "" : "s"}
      </span>
      {visibleToClient === false && (
        <span className="text-[10px] uppercase tracking-wide text-text-muted border border-border-default rounded px-1.5 py-0.5">
          Internal
        </span>
      )}
      <span className="text-sm font-semibold text-text-primary tabular-nums">
        {formatCurrency(sectionTotal, currency)}
      </span>
    </button>
  );
}
