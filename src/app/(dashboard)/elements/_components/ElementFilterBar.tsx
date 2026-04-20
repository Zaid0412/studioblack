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
import { ToggleSwitch } from "@/components/ui/ToggleSwitch";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import { ALLOWED_UNITS, type ElementUnit } from "@/lib/validations";
import type { ElementFilterState } from "../_hooks/useElementFilters";

const ALL = "__all__";

interface Props {
  state: ElementFilterState;
  onSearchChange: (value: string) => void;
  onUnitChange: (unit: ElementUnit | null) => void;
  onShowArchivedChange: (archived: boolean) => void;
  onClear: () => void;
}

export function ElementFilterBar({
  state,
  onSearchChange,
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

      <Select
        value={state.unit ?? ALL}
        onValueChange={(v) =>
          onUnitChange(v === ALL ? null : (v as ElementUnit))
        }
      >
        <SelectTrigger className="w-full lg:w-40">
          <SelectValue placeholder={t("filterByUnit")} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>{t("allUnits")}</SelectItem>
          {ALLOWED_UNITS.map((unit) => (
            <SelectItem key={unit} value={unit}>
              {unit}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

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
