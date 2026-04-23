"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import { Check, ChevronDown } from "lucide-react";
import { SearchableDropdown } from "@/components/ui/SearchableDropdown";
import { ALLOWED_UNITS, type ElementUnit } from "@/lib/validations";
import { cn } from "@/lib/utils";

interface UnitFilterSelectProps {
  value: ElementUnit | null;
  onChange: (unit: ElementUnit | null) => void;
  className?: string;
  /** Defaults to the "filter by unit" placeholder. Pass a custom one per surface. */
  placeholder?: string;
  /** Defaults to the "All units" i18n label. */
  allLabel?: string;
}

/**
 * Searchable unit-filter dropdown shared by the elements library and BOQ.
 * Pulls localized unit names via `useTranslations("elements")`.
 */
export function UnitFilterSelect({
  value,
  onChange,
  className,
  placeholder,
  allLabel,
}: UnitFilterSelectProps) {
  const t = useTranslations("elements");
  const tCommon = useTranslations("common");

  const options = useMemo(
    () =>
      ALLOWED_UNITS.map((code) => ({
        code,
        name: t(`unitLabels.${code}`),
      })),
    [t]
  );

  return (
    <SearchableDropdown
      minContentWidth={220}
      isEmpty={options.length === 0}
      trigger={
        <button
          type="button"
          className={cn(
            "flex items-center justify-between w-full rounded-lg border border-border-default bg-bg-input px-3 py-2 text-sm text-text-primary cursor-pointer",
            "focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/30",
            className
          )}
        >
          <span className="truncate">
            {value ? (
              <span className="font-medium">{value}</span>
            ) : (
              <span className="text-text-muted">
                {placeholder ?? t("filterByUnit")}
              </span>
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
                onChange(null);
                close();
              }}
              className={cn(
                "flex items-center gap-2 w-full px-3 py-2 text-sm text-left hover:bg-bg-elevated cursor-pointer",
                value === null && "text-accent"
              )}
            >
              <span className="w-4 shrink-0">
                {value === null && <Check className="h-4 w-4" />}
              </span>
              <span>{allLabel ?? t("allUnits")}</span>
            </button>
            {filtered.length === 0 ? (
              <p className="px-3 py-4 text-sm text-text-muted text-center">
                {tCommon("noResults")}
              </p>
            ) : (
              filtered.map((opt) => {
                const selected = value === opt.code;
                return (
                  <button
                    key={opt.code}
                    type="button"
                    onClick={() => {
                      onChange(opt.code);
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
                    <span className="truncate text-text-muted">{opt.name}</span>
                  </button>
                );
              })
            )}
          </>
        );
      }}
    </SearchableDropdown>
  );
}
