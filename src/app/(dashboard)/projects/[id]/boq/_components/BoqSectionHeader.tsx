"use client";

import type { DOMAttributes, HTMLAttributes } from "react";
import { ChevronDown, GripVertical, MoreVertical } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/DropdownMenu";
import { formatCurrency } from "../_lib/formatters";

interface BoqSectionHeaderProps {
  title: string;
  itemCount: number;
  sectionTotal: number;
  currency: string;
  collapsed: boolean;
  onToggle: () => void;
  visibleToClient?: boolean;
  /** Omit to hide the actions menu entirely. */
  onRename?: () => void;
  onToggleVisibility?: () => void;
  onDelete?: () => void;
  onAddItem?: () => void;
  /** When provided, renders a draggable grip handle wired to dnd-kit sortable. */
  dragHandleProps?: HTMLAttributes<HTMLButtonElement> &
    DOMAttributes<HTMLButtonElement> & {
      ref?: React.Ref<HTMLButtonElement>;
    };
}

/** Collapsible BOQ section row: drag handle, title, item count, section total, and optional actions menu. */
export function BoqSectionHeader({
  title,
  itemCount,
  sectionTotal,
  currency,
  collapsed,
  onToggle,
  visibleToClient,
  onRename,
  onToggleVisibility,
  onDelete,
  onAddItem,
  dragHandleProps,
}: BoqSectionHeaderProps) {
  const hasMenu = onRename || onToggleVisibility || onDelete || onAddItem;

  return (
    <div className="w-full flex items-center gap-2 px-4 py-3 bg-bg-elevated border-b border-border-default">
      {dragHandleProps && (
        <button
          type="button"
          aria-label={`Reorder ${title}`}
          {...dragHandleProps}
          className="shrink-0 text-text-muted hover:text-text-primary cursor-grab active:cursor-grabbing touch-none p-0.5 -ml-1"
        >
          <GripVertical className="w-4 h-4" />
        </button>
      )}
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={!collapsed}
        className="flex-1 flex items-center gap-3 text-left hover:opacity-80 transition-opacity cursor-pointer"
      >
        <ChevronDown
          aria-hidden="true"
          className={`w-4 h-4 text-text-muted flex-shrink-0 transition-transform duration-300 ${
            collapsed ? "-rotate-90" : "rotate-0"
          }`}
        />
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
      {hasMenu && (
        <DropdownMenu>
          <DropdownMenuTrigger
            className="p-1 rounded hover:bg-bg-secondary/70 text-text-muted hover:text-text-primary cursor-pointer"
            aria-label={`Actions for ${title}`}
          >
            <MoreVertical className="h-4 w-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {onAddItem && (
              <DropdownMenuItem onSelect={onAddItem}>
                Add item here
              </DropdownMenuItem>
            )}
            {onRename && (
              <DropdownMenuItem onSelect={onRename}>Rename</DropdownMenuItem>
            )}
            {onToggleVisibility && (
              <DropdownMenuItem onSelect={onToggleVisibility}>
                {visibleToClient === false ? "Show to client" : "Mark internal"}
              </DropdownMenuItem>
            )}
            {onDelete && (
              <DropdownMenuItem
                onSelect={onDelete}
                className="text-error focus:text-error"
              >
                Delete section
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}
