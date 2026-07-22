"use client";

import { ChevronDown, ChevronUp, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SortDir, SortField } from "../_lib/categoryFilters";

interface Props {
  label: string;
  field: SortField;
  activeField: SortField | null;
  dir: SortDir;
  onSort: (field: SortField) => void;
  /** Right-align the label + arrow (for numeric columns). */
  alignRight?: boolean;
  className?: string;
}

/** A clickable column header that sorts the tree within each sibling group. */
export function CategorySortHeader({
  label,
  field,
  activeField,
  dir,
  onSort,
  alignRight = false,
  className,
}: Props) {
  const active = activeField === field;
  const Icon = !active ? ChevronsUpDown : dir === "asc" ? ChevronUp : ChevronDown;

  return (
    <th className={className}>
      <button
        type="button"
        onClick={() => onSort(field)}
        className={cn(
          "inline-flex items-center gap-1 text-[11px] font-medium uppercase tracking-wider transition-colors hover:text-text-primary",
          active ? "text-text-primary" : "text-text-muted",
          alignRight && "flex-row-reverse"
        )}
      >
        <span className="truncate">{label}</span>
        <Icon className={cn("w-3 h-3 shrink-0", !active && "opacity-40")} />
      </button>
    </th>
  );
}
