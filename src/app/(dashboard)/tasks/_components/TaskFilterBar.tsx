"use client";

import { SearchInput } from "@/components/ui/SearchInput";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  STATUSES,
  PRIORITIES,
  CATEGORIES,
  STATUS_LABEL,
  capitalize,
} from "@/lib/taskUtils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TaskFilterBarProps {
  searchValue: string;
  statusFilter: string;
  priorityFilter: string;
  categoryFilter: string;
  onFilterChange: (key: string, value: string) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 *
 */
export function TaskFilterBar({
  searchValue,
  statusFilter,
  priorityFilter,
  categoryFilter,
  onFilterChange,
}: TaskFilterBarProps) {
  return (
    <div className="flex items-center gap-3">
      <SearchInput
        placeholder="Search tasks..."
        value={searchValue}
        onChange={(e) => onFilterChange("search", e.target.value)}
        containerClassName="flex-1"
      />
      <Select
        value={statusFilter}
        onValueChange={(v) => onFilterChange("status", v)}
      >
        <SelectTrigger className="w-[150px]">
          <SelectValue placeholder="All Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Status</SelectItem>
          {STATUSES.map((s) => (
            <SelectItem key={s} value={s}>
              {STATUS_LABEL[s]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select
        value={priorityFilter}
        onValueChange={(v) => onFilterChange("priority", v)}
      >
        <SelectTrigger className="w-[140px]">
          <SelectValue placeholder="All Priority" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Priority</SelectItem>
          {PRIORITIES.map((p) => (
            <SelectItem key={p} value={p}>
              {capitalize(p)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select
        value={categoryFilter}
        onValueChange={(v) => onFilterChange("category", v)}
      >
        <SelectTrigger className="w-[150px]">
          <SelectValue placeholder="All Category" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Category</SelectItem>
          {CATEGORIES.map((c) => (
            <SelectItem key={c} value={c}>
              {capitalize(c)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
