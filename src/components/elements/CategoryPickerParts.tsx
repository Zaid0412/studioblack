"use client";

import { forwardRef, type ReactNode } from "react";
import { Check, ChevronDown } from "lucide-react";
import { CategoryIcon } from "@/components/elements/CategoryIcon";
import type { CategoryOption } from "@/app/(dashboard)/elements/_lib/categoryUtils";
import { cn } from "@/lib/utils";

/**
 * The chrome the two category pickers share.
 *
 * They differ in *behaviour* — `ServiceAreaSelect` drills and accepts only
 * leaves, `CategoryFilterSelect` is flat and accepts any level — but a filter
 * that didn't look like a field would just read as a bug. Keeping the trigger
 * and the rows here is what stops the two from drifting apart visually.
 */

interface TriggerProps {
  /**
   * Null renders the placeholder. May be any depth: a grandfathered value still
   * shows its (partial) path rather than going blank.
   */
  selected: CategoryOption | null;
  placeholder: string;
  /** Filter-bar sizing, to match the controls beside it. */
  compact?: boolean;
  disabled?: boolean;
}

/**
 * Radix's `PopoverTrigger asChild` clones this and hands it the ref and the
 * open/close handlers — so it must forward both to the real button.
 */
export const CategoryTrigger = forwardRef<HTMLButtonElement, TriggerProps>(
  (
    { selected, placeholder, compact = false, disabled = false, ...props },
    ref
  ) => (
    <button
      ref={ref}
      type="button"
      disabled={disabled}
      // No `aria-required`: it isn't valid on a button role, and this isn't a
      // combobox (it opens a popover, and carries no aria-expanded/controls).
      // So a `*` on the label is visual only — giving this real combobox
      // semantics is a SearchableDropdown change, not an asterisk change.
      className={cn(
        "flex items-center justify-between w-full rounded-lg border border-border-default bg-bg-input text-sm text-text-primary",
        compact ? "px-3 py-2" : "px-4 py-3",
        "focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/30",
        disabled && "opacity-60 cursor-not-allowed"
      )}
      {...props}
    >
      <span className="flex items-center gap-2 truncate">
        {selected ? (
          <>
            <CategoryIcon
              icon={selected.icon}
              color={selected.color}
              size={14}
            />
            <span className="truncate">{selected.label}</span>
          </>
        ) : (
          <span className="text-text-muted">{placeholder}</span>
        )}
      </span>
      <ChevronDown className="h-4 w-4 text-text-muted shrink-0" />
    </button>
  )
);
CategoryTrigger.displayName = "CategoryTrigger";

interface RowProps {
  icon: string | null;
  color: string | null;
  name: string;
  /**
   * The full breadcrumb, shown under the name where the name alone is ambiguous
   * — while searching, or wherever there's no indent to read.
   */
  path?: string;
  selected?: boolean;
  emphasis?: boolean;
  indent?: number;
  /** A chevron, on a row that descends rather than selects. */
  trailing?: ReactNode;
  onClick: () => void;
}

/** One node in either picker's list: icon, name, and an optional full path. */
export function CategoryRow({
  icon,
  color,
  name,
  path,
  selected = false,
  emphasis = false,
  indent = 0,
  trailing,
  onClick,
}: RowProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-center gap-2 w-full px-3 py-2 text-sm text-left hover:bg-bg-elevated",
        selected && "text-accent"
      )}
      style={indent ? { paddingLeft: `${12 + indent * 12}px` } : undefined}
    >
      <span className="w-4 shrink-0">
        {selected && <Check className="h-4 w-4" />}
      </span>
      <CategoryIcon icon={icon} color={color} size={14} />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className={cn("truncate", emphasis && "font-semibold")}>
          {name}
        </span>
        {path && (
          <span className="truncate text-[11px] text-text-muted">{path}</span>
        )}
      </span>
      {trailing}
    </button>
  );
}

/** "Nothing here" — an empty branch, or a search that matched no leaf. */
export function CategoryPickerEmpty({ children }: { children: ReactNode }) {
  return (
    <p className="px-3 py-4 text-sm text-text-muted text-center">{children}</p>
  );
}
