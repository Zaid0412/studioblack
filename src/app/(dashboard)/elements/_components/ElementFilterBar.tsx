"use client";

import { useTranslations } from "next-intl";
import { X } from "lucide-react";
import { SearchInput } from "@/components/ui/SearchInput";
import { UnitFilterSelect } from "@/components/ui/UnitFilterSelect";
import { ToggleSwitch } from "@/components/ui/ToggleSwitch";
import { Button } from "@/components/ui/button";
import { type ElementUnit } from "@/lib/validations";
import type { ElementCategoryNode } from "@/types";
import { CategoryFilterSelect } from "./CategoryFilterSelect";
import type { ElementFilterState } from "../_hooks/useElementFilters";

interface Props {
  state: ElementFilterState;
  categoryTree: ElementCategoryNode[];
  onSearchChange: (value: string) => void;
  onCategoryChange: (id: string | null) => void;
  onUnitChange: (unit: ElementUnit | null) => void;
  onShowArchivedChange: (archived: boolean) => void;
  onClear: () => void;
}

/** Search/category/unit/archived filter row above the elements table, with a clear-all button when any filter is active. */
export function ElementFilterBar({
  state,
  categoryTree,
  onSearchChange,
  onCategoryChange,
  onUnitChange,
  onShowArchivedChange,
  onClear,
}: Props) {
  const t = useTranslations("elements");
  const hasActive =
    state.search || state.unit || state.categoryId || !state.isActive;

  return (
    <div className="flex flex-col lg:flex-row gap-3 items-stretch lg:items-center">
      <div className="flex-1 min-w-0">
        <SearchInput
          placeholder={t("searchPlaceholder")}
          value={state.search}
          debounceMs={300}
          onDebouncedChange={onSearchChange}
        />
      </div>

      <div className="w-full lg:w-56">
        <CategoryFilterSelect
          value={state.categoryId}
          onChange={onCategoryChange}
          tree={categoryTree}
        />
      </div>

      <div className="w-full lg:w-40">
        <UnitFilterSelect value={state.unit} onChange={onUnitChange} />
      </div>

      <div className="flex items-center gap-2 text-sm text-text-secondary whitespace-nowrap">
        <span>{t("showArchived")}</span>
        <ToggleSwitch
          checked={!state.isActive}
          onChange={(checked) => onShowArchivedChange(checked)}
        />
      </div>

      {hasActive && (
        <Button variant="ghost" size="sm" onClick={onClear}>
          <X className="w-4 h-4" />
          {t("clearFilters")}
        </Button>
      )}
    </div>
  );
}
