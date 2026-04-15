"use client";

import { useTranslations } from "next-intl";
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

/** Search and filter controls for the task list (status, priority, category). */
export function TaskFilterBar({
  searchValue,
  statusFilter,
  priorityFilter,
  categoryFilter,
  onFilterChange,
}: TaskFilterBarProps) {
  const t = useTranslations("tasks");
  return (
    <div className="flex flex-col lg:flex-row items-stretch lg:items-center gap-3">
      <SearchInput
        placeholder={t("searchPlaceholder")}
        value={searchValue}
        onDebouncedChange={(val) => onFilterChange("search", val)}
        debounceMs={300}
        containerClassName="flex-1"
      />
      <div className="grid grid-cols-3 lg:flex lg:items-center gap-3">
        <Select
          value={statusFilter}
          onValueChange={(v) => onFilterChange("status", v)}
        >
          <SelectTrigger className="w-full lg:w-[150px]">
            <SelectValue placeholder={t("allStatus")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("allStatus")}</SelectItem>
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
          <SelectTrigger className="w-full lg:w-[140px]">
            <SelectValue placeholder={t("allPriority")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("allPriority")}</SelectItem>
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
          <SelectTrigger className="w-full lg:w-[150px]">
            <SelectValue placeholder={t("allCategory")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("allCategory")}</SelectItem>
            {CATEGORIES.map((c) => (
              <SelectItem key={c} value={c}>
                {capitalize(c)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
