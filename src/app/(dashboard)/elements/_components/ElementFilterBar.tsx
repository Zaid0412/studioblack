"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import { Check, ChevronDown, X } from "lucide-react";
import { SearchInput } from "@/components/ui/SearchInput";
import { SearchableDropdown } from "@/components/ui/SearchableDropdown";
import { ToggleSwitch } from "@/components/ui/ToggleSwitch";
import { Button } from "@/components/ui/button";
import { ALLOWED_UNITS, type ElementUnit } from "@/lib/validations";
import { cn } from "@/lib/utils";
import type { ElementFilterState } from "../_hooks/useElementFilters";

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
  const tCommon = useTranslations("common");
  const hasActive =
    state.search || state.unit || state.categoryId || !state.isActive;

  const options = useMemo(
    () =>
      ALLOWED_UNITS.map((code) => ({
        code,
        name: t(`unitLabels.${code}`),
      })),
    [t]
  );

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

      <div className="w-full lg:w-40">
        <SearchableDropdown
          minContentWidth={220}
          isEmpty={options.length === 0}
          trigger={
            <button
              type="button"
              className={cn(
                "flex items-center justify-between w-full rounded-lg border border-border-default bg-bg-input px-3 py-2 text-sm text-text-primary",
                "focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/30"
              )}
            >
              <span className="truncate">
                {state.unit ? (
                  <span className="font-medium">{state.unit}</span>
                ) : (
                  <span className="text-text-muted">{t("filterByUnit")}</span>
                )}
              </span>
              <ChevronDown className="h-4 w-4 text-text-muted shrink-0" />
            </button>
          }
        >
          {(query, close) => {
            const filtered = query
              ? options.filter(
                  (o) =>
                    o.code.toLowerCase().includes(query) ||
                    o.name.toLowerCase().includes(query)
                )
              : options;
            return (
              <>
                <button
                  type="button"
                  onClick={() => {
                    onUnitChange(null);
                    close();
                  }}
                  className={cn(
                    "flex items-center gap-2 w-full px-3 py-2 text-sm text-left hover:bg-bg-elevated cursor-pointer",
                    state.unit === null && "text-accent"
                  )}
                >
                  <span className="w-4 shrink-0">
                    {state.unit === null && <Check className="h-4 w-4" />}
                  </span>
                  <span>{t("allUnits")}</span>
                </button>
                {filtered.length === 0 ? (
                  <p className="px-3 py-4 text-sm text-text-muted text-center">
                    {tCommon("noResults")}
                  </p>
                ) : (
                  filtered.map((opt) => {
                    const selected = state.unit === opt.code;
                    return (
                      <button
                        key={opt.code}
                        type="button"
                        onClick={() => {
                          onUnitChange(opt.code);
                          close();
                        }}
                        className={cn(
                          "flex items-center gap-2 w-full px-3 py-2 text-sm text-left hover:bg-bg-elevated cursor-pointer",
                          selected && "text-accent"
                        )}
                      >
                        <span className="w-4 shrink-0">
                          {selected && <Check className="h-4 w-4" />}
                        </span>
                        <span className="font-medium w-12 shrink-0">
                          {opt.code}
                        </span>
                        <span className="truncate text-text-muted">
                          {opt.name}
                        </span>
                      </button>
                    );
                  })
                )}
              </>
            );
          }}
        </SearchableDropdown>
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
