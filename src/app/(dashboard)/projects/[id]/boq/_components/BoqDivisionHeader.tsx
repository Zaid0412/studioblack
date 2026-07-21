"use client";

import { ChevronDown, Layers } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { formatCurrency } from "../_lib/formatters";

/**
 * A division band spanning the sections beneath it — the top grouping level
 * (Division → Section → line items). Collapsible (toggles its whole block).
 * Visual only: sections are assigned to a division via the section editor, not
 * by dragging onto this band.
 */
export function BoqDivisionHeader({
  name,
  itemCount,
  divisionTotal,
  currency,
  collapsed,
  onToggle,
}: {
  name: string;
  itemCount: number;
  divisionTotal: number;
  currency: string;
  collapsed: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="flex items-center gap-2 border-y border-l-2 border-border-default border-l-accent bg-bg-input pl-3 py-2">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={!collapsed}
        className="flex items-center gap-2 cursor-pointer text-left transition-opacity hover:opacity-80"
      >
        <ChevronDown
          aria-hidden="true"
          className={`h-4 w-4 shrink-0 text-text-muted transition-transform duration-300 ${
            collapsed ? "-rotate-90" : "rotate-0"
          }`}
        />
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="flex items-center gap-2">
              <Layers className="h-4 w-4 shrink-0 text-accent" />
              <span className="text-xs font-bold uppercase tracking-wide text-text-primary whitespace-nowrap">
                {name}
              </span>
            </span>
          </TooltipTrigger>
          <TooltipContent side="right">
            <span className="font-semibold">Division</span> — groups related
            sections and items
          </TooltipContent>
        </Tooltip>
      </button>
      <span className="text-[11px] text-text-muted whitespace-nowrap">
        {itemCount === 1 ? "1 item" : `${itemCount} items`}
      </span>
      {/* Pinned to the visible right edge so it survives horizontal scroll. */}
      <span className="sticky right-0 ml-auto flex items-center bg-bg-input pl-4 pr-4 border-l border-border-default shadow-[-6px_0_6px_-6px_rgba(0,0,0,0.12)] text-xs font-semibold text-text-secondary tabular-nums whitespace-nowrap">
        {formatCurrency(divisionTotal, currency)}
      </span>
    </div>
  );
}
