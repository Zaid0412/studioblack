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

interface LabeledSearchableSelectBaseProps<T extends string> {
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
  /**
   * Smaller default padding/typography. `"md"` (default) matches form-field
   * sizing; `"sm"` matches inline filter chips.
   */
  triggerSize?: "sm" | "md";
  /** Custom empty-state text in the trigger. Defaults to a muted em-dash. */
  triggerPlaceholder?: string;
  /** Hide the selected option's `name` next to its code in the trigger. */
  hideTriggerName?: boolean;
  /**
   * Hide the selected option's `code` in the trigger. Useful when codes are
   * opaque IDs (UUIDs) and only the name is meaningful to the user.
   */
  hideTriggerCode?: boolean;
  /** Override the trigger's outer className (border/bg/etc). */
  triggerClassName?: string;
}

/**
 * Form-field shape — onChange only ever fires with a real `T`. Used by
 * `UnitSelect`, `CurrencySelect`, etc. where the field always has a value
 * and the user can't reset it from inside the dropdown.
 */
type LabeledSearchableSelectStrictProps<T extends string> =
  LabeledSearchableSelectBaseProps<T> & {
    value: T | "";
    onChange: (code: T) => void;
    allowClear?: undefined;
  };

/**
 * Filter-field shape — `allowClear` adds a leading entry that calls
 * `onChange("")` to reset. Used by `UnitFilterSelect` and similar.
 */
type LabeledSearchableSelectClearableProps<T extends string> =
  LabeledSearchableSelectBaseProps<T> & {
    value: T | "";
    onChange: (code: T | "") => void;
    allowClear: { label: string };
  };

type LabeledSearchableSelectProps<T extends string> =
  | LabeledSearchableSelectStrictProps<T>
  | LabeledSearchableSelectClearableProps<T>;

/**
 * Themed, searchable `<code> · <label>` select. Drives both the form-field
 * pickers (currency, unit) and the inline filter dropdowns (filter-by-unit).
 * The optional `allowClear` adds a leading entry that resets the value.
 */
export function LabeledSearchableSelect<T extends string>(
  props: LabeledSearchableSelectProps<T>
) {
  const {
    value,
    options,
    label,
    required,
    disabled,
    codeColumnClassName,
    minContentWidth = 260,
    maxListHeight,
    allowClear,
    triggerSize = "md",
    triggerPlaceholder,
    hideTriggerName,
    hideTriggerCode,
    triggerClassName,
  } = props;
  // Union-typed internal handler — `T` is assignable to `T | ""`, and the
  // clear button (which calls with `""`) only renders when `allowClear` is
  // set, where the props variant guarantees the wider signature. Discriminated
  // narrowing across destructured fields is awkward, so cast once here.
  const onChange = props.onChange as (code: T | "") => void;
  const tCommon = useTranslations("common");

  const selectedName = useMemo(
    () => options.find((o) => o.code === value)?.name ?? "",
    [options, value]
  );

  const triggerSizeClass = triggerSize === "sm" ? "px-3 py-2" : "px-4 py-3";

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
              "flex items-center justify-between w-full rounded-lg border border-border-default bg-bg-input text-sm text-text-primary cursor-pointer",
              "focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/30",
              triggerSizeClass,
              disabled && "opacity-60 pointer-events-none",
              triggerClassName
            )}
          >
            <span className="flex items-center gap-2 truncate">
              {value ? (
                <>
                  {!hideTriggerCode && (
                    <span className="font-medium">{value}</span>
                  )}
                  {!hideTriggerName && selectedName && (
                    <span
                      className={cn(
                        "truncate",
                        hideTriggerCode
                          ? "text-text-primary"
                          : "text-text-muted"
                      )}
                    >
                      {selectedName}
                    </span>
                  )}
                </>
              ) : triggerPlaceholder ? (
                <span className="text-text-muted">{triggerPlaceholder}</span>
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
          return (
            <>
              {allowClear && (
                <button
                  type="button"
                  onClick={() => {
                    onChange("");
                    close();
                  }}
                  className={cn(
                    "flex items-center gap-2 w-full px-3 py-2 text-sm text-left hover:bg-bg-elevated cursor-pointer",
                    value === "" && "text-accent"
                  )}
                >
                  <span className="w-4 shrink-0">
                    {value === "" && <Check className="h-4 w-4" />}
                  </span>
                  <span>{allowClear.label}</span>
                </button>
              )}
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
                      <span
                        className={cn(
                          "font-medium shrink-0",
                          codeColumnClassName ?? "w-12"
                        )}
                      >
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
  );
}
