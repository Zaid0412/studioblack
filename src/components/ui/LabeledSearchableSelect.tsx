"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import { Check, ChevronDown } from "lucide-react";
import { SearchableDropdown } from "@/components/ui/SearchableDropdown";
import { cn } from "@/lib/utils";

export interface SelectOption<T extends string = string> {
  code: T;
  name: string;
}

interface LabeledSearchableSelectProps<T extends string> {
  value: T | "";
  onChange: (code: T) => void;
  options: SelectOption<T>[];
  label?: string;
  required?: boolean;
  disabled?: boolean;
  /** Width of the option row's code column. Defaults to "w-12". */
  codeColumnClassName?: string;
  /** Popover min-width in pixels. Defaults to 260. */
  minContentWidth?: number;
  /** Popover max-height in pixels. Passed through to SearchableDropdown. */
  maxListHeight?: number;
}

/**
 * Themed, searchable `<code> · <label>`-style select. Used for both the
 * element-unit and currency pickers — differ only by option source and
 * column widths. The empty state + search-filter behaviour is shared.
 */
export function LabeledSearchableSelect<T extends string>({
  value,
  onChange,
  options,
  label,
  required,
  disabled,
  codeColumnClassName,
  minContentWidth = 260,
  maxListHeight,
}: LabeledSearchableSelectProps<T>) {
  const tCommon = useTranslations("common");

  const selectedName = useMemo(
    () => options.find((o) => o.code === value)?.name ?? "",
    [options, value]
  );

  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label className="text-[13px] font-medium text-text-secondary">
          {label}
          {required && <span className="text-error ml-0.5">*</span>}
        </label>
      )}
      <SearchableDropdown
        minContentWidth={minContentWidth}
        maxListHeight={maxListHeight}
        isEmpty={options.length === 0}
        trigger={
          <button
            type="button"
            disabled={disabled}
            className={cn(
              "flex items-center justify-between w-full rounded-lg border border-border-default bg-bg-input px-4 py-3 text-sm text-text-primary cursor-pointer",
              "focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/30",
              disabled && "opacity-60 pointer-events-none"
            )}
          >
            <span className="flex items-center gap-2 truncate">
              {value ? (
                <>
                  <span className="font-medium">{value}</span>
                  {selectedName && (
                    <span className="truncate text-text-muted">
                      {selectedName}
                    </span>
                  )}
                </>
              ) : (
                <span className="italic text-text-muted">—</span>
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
          if (filtered.length === 0) {
            return (
              <p className="px-3 py-4 text-sm text-text-muted text-center">
                {tCommon("noResults")}
              </p>
            );
          }
          return filtered.map((opt) => {
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
                <span
                  className={cn(
                    "font-medium shrink-0",
                    codeColumnClassName ?? "w-12"
                  )}
                >
                  {opt.code}
                </span>
                <span className="truncate text-text-muted">{opt.name}</span>
              </button>
            );
          });
        }}
      </SearchableDropdown>
    </div>
  );
}
