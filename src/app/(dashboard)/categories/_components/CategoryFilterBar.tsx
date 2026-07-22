"use client";

import { useTranslations } from "next-intl";
import { X } from "lucide-react";
import { SearchInput } from "@/components/ui/SearchInput";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import {
  hasActiveFilters,
  type CategoryFilters,
  type CategoryLevel,
  type UsageFilter,
} from "../_lib/categoryFilters";

const ALL = "__all__";

interface Props {
  filters: CategoryFilters;
  onSearchChange: (value: string) => void;
  onLevelChange: (level: CategoryLevel | null) => void;
  onUsageChange: (usage: UsageFilter | null) => void;
  onClear: () => void;
}

/** Search + level + usage filter row above the category tree. */
export function CategoryFilterBar({
  filters,
  onSearchChange,
  onLevelChange,
  onUsageChange,
  onClear,
}: Props) {
  const t = useTranslations("elements");

  return (
    <div className="flex flex-col lg:flex-row gap-3 items-stretch lg:items-center">
      <div className="flex-1 min-w-0">
        <SearchInput
          placeholder={t("categorySearchPlaceholder")}
          value={filters.search}
          debounceMs={250}
          onDebouncedChange={onSearchChange}
        />
      </div>

      <div className="w-full lg:w-48">
        <Select
          value={filters.level === null ? ALL : String(filters.level)}
          onValueChange={(v) =>
            onLevelChange(v === ALL ? null : (Number(v) as CategoryLevel))
          }
        >
          <SelectTrigger>
            <SelectValue placeholder={t("filterByLevel")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>{t("levelAll")}</SelectItem>
            <SelectItem value="1">{t("levelCategory")}</SelectItem>
            <SelectItem value="2">{t("levelSubcategory")}</SelectItem>
            <SelectItem value="3">{t("levelServiceArea")}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="w-full lg:w-44">
        <Select
          value={filters.usage ?? ALL}
          onValueChange={(v) =>
            onUsageChange(v === ALL ? null : (v as UsageFilter))
          }
        >
          <SelectTrigger>
            <SelectValue placeholder={t("filterByUsage")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>{t("usageAll")}</SelectItem>
            <SelectItem value="in-use">{t("usageInUse")}</SelectItem>
            <SelectItem value="unused">{t("usageUnused")}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {hasActiveFilters(filters) && (
        <Button variant="ghost" size="sm" onClick={onClear}>
          <X className="w-4 h-4" />
          {t("clearFilters")}
        </Button>
      )}
    </div>
  );
}
