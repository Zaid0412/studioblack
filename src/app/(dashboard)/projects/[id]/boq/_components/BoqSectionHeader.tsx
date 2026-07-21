"use client";

import type { DOMAttributes, HTMLAttributes } from "react";
import { ChevronDown, GripVertical, MoreVertical } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/DropdownMenu";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { formatCurrency } from "../_lib/formatters";
import type { SectionSelectionState } from "@/hooks/useBoqSelection";

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
  /** Opens the "Add new custom item" sheet pre-filled to this section. */
  onAddCustomItem?: () => void;
  /** Opens the element-library picker pre-filled to this section. */
  onAddFromLibrary?: () => void;
  /** When provided, renders a draggable grip handle wired to dnd-kit sortable. */
  dragHandleProps?: HTMLAttributes<HTMLButtonElement> &
    DOMAttributes<HTMLButtonElement> & {
      ref?: React.Ref<HTMLButtonElement>;
    };
  /** When defined, renders a leading tri-state checkbox for bulk-select mode. */
  selectionState?: SectionSelectionState;
  onToggleSelection?: () => void;
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
  onAddCustomItem,
  onAddFromLibrary,
  dragHandleProps,
  selectionState,
  onToggleSelection,
}: BoqSectionHeaderProps) {
  const canAddItem = !!onAddCustomItem || !!onAddFromLibrary;
  const hasEditItems = !!onRename || !!onToggleVisibility;
  const hasMenu = hasEditItems || onDelete || canAddItem;
  const selectionMode = !!onToggleSelection;

  return (
    <div
      className={`w-full flex items-center gap-2 ${selectionMode ? "pl-6" : "pl-8"} py-3 bg-bg-elevated border-b border-border-default`}
    >
      {selectionMode && (
        <div className="w-8 flex items-center justify-center shrink-0">
          <Checkbox
            checked={selectionState === "all"}
            indeterminate={selectionState === "some"}
            onCheckedChange={() => onToggleSelection!()}
            disabled={itemCount === 0}
            aria-label={`Select all items in ${title}`}
          />
        </div>
      )}
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
        className="flex-1 min-w-0 flex items-center gap-3 text-left hover:opacity-80 transition-opacity cursor-pointer"
      >
        <ChevronDown
          aria-hidden="true"
          className={`w-4 h-4 text-text-muted flex-shrink-0 transition-transform duration-300 ${
            collapsed ? "-rotate-90" : "rotate-0"
          }`}
        />
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="text-sm font-semibold text-text-primary flex-1 truncate">
              {title}
            </span>
          </TooltipTrigger>
          <TooltipContent side="right">
            <span className="font-semibold">Section</span> — a group of line
            items within a division
          </TooltipContent>
        </Tooltip>
      </button>
      {/* Summary + actions pinned to the right edge of the visible area, so they
          stay reachable while the wide table scrolls horizontally. */}
      <div className="sticky right-0 flex items-center gap-3 pl-4 pr-4 bg-bg-elevated border-l border-border-default shadow-[-6px_0_6px_-6px_rgba(0,0,0,0.12)]">
        <span className="text-xs text-text-muted whitespace-nowrap">
          {itemCount} item{itemCount === 1 ? "" : "s"}
        </span>
        {visibleToClient === false && (
          <span className="text-[10px] uppercase tracking-wide text-text-muted border border-border-default rounded px-1.5 py-0.5">
            Internal
          </span>
        )}
        <span className="text-sm font-semibold text-text-primary tabular-nums whitespace-nowrap">
          {formatCurrency(sectionTotal, currency)}
        </span>
        {hasMenu && (
          <DropdownMenu>
            <DropdownMenuTrigger
              className="p-1 rounded hover:bg-bg-secondary/70 text-text-muted hover:text-text-primary cursor-pointer"
              aria-label={`Actions for ${title}`}
            >
              <MoreVertical className="h-4 w-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {canAddItem && (
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger>
                    Add item here…
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent>
                    {onAddCustomItem && (
                      <DropdownMenuItem onSelect={onAddCustomItem}>
                        New custom item
                      </DropdownMenuItem>
                    )}
                    {onAddFromLibrary && (
                      <DropdownMenuItem onSelect={onAddFromLibrary}>
                        From element library…
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
              )}
              {canAddItem && hasEditItems && <DropdownMenuSeparator />}
              {onRename && (
                <DropdownMenuItem onSelect={onRename}>
                  Edit section…
                </DropdownMenuItem>
              )}
              {onToggleVisibility && (
                <DropdownMenuItem onSelect={onToggleVisibility}>
                  {visibleToClient === false
                    ? "Show to client"
                    : "Mark internal"}
                </DropdownMenuItem>
              )}
              {onDelete && (
                <>
                  {(canAddItem || hasEditItems) && <DropdownMenuSeparator />}
                  <DropdownMenuItem onSelect={onDelete} destructive>
                    Delete section
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </div>
  );
}
