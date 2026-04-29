"use client";

import { ChevronDown, ChevronUp, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";

export type SortDirection = "asc" | "desc";

/** Tri-state sort: `null` means unsorted (cycle-back-to-default position). */
export type SortConfig<K extends string = string> = {
  key: K;
  direction: SortDirection;
} | null;

/** Cycle: unsorted → asc → desc → unsorted. */
export function nextSortDirection<K extends string>(
  current: SortConfig<K>,
  key: K
): SortConfig<K> {
  if (!current || current.key !== key) return { key, direction: "asc" };
  if (current.direction === "asc") return { key, direction: "desc" };
  return null;
}

interface SortIconProps<K extends string> {
  sortKey: K;
  config: SortConfig<K>;
}

/** Tri-state chevron: ↕ (unsorted), ↑ (asc), ↓ (desc). */
export function SortIcon<K extends string>({
  sortKey,
  config,
}: SortIconProps<K>) {
  if (!config || config.key !== sortKey)
    return <ChevronsUpDown className="w-3 h-3 text-text-muted" />;
  return config.direction === "asc" ? (
    <ChevronUp className="w-3 h-3 text-text-primary" />
  ) : (
    <ChevronDown className="w-3 h-3 text-text-primary" />
  );
}

interface SortableHeaderButtonProps<K extends string> {
  sortKey: K;
  config: SortConfig<K>;
  onSort: (key: K) => void;
  className?: string;
  align?: "left" | "right";
  children: React.ReactNode;
}

/**
 * Clickable column header that cycles its sort key. Caller owns the sort
 * config so this works with both local-state and URL-state models.
 */
export function SortableHeaderButton<K extends string>({
  sortKey,
  config,
  onSort,
  className,
  align = "left",
  children,
}: SortableHeaderButtonProps<K>) {
  return (
    <button
      type="button"
      onClick={() => onSort(sortKey)}
      className={cn(
        "flex items-center gap-1 text-xs font-semibold text-text-primary transition-colors cursor-pointer select-none",
        align === "right" && "justify-end",
        className
      )}
    >
      {children}
      <SortIcon sortKey={sortKey} config={config} />
    </button>
  );
}
