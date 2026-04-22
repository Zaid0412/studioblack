"use client";

import { useMemo } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Check, ChevronDown } from "lucide-react";
import { SearchableDropdown } from "@/components/ui/SearchableDropdown";
import { cn } from "@/lib/utils";

interface Props {
  value: string;
  onChange: (code: string) => void;
  label?: string;
  required?: boolean;
  disabled?: boolean;
}

interface CurrencyOption {
  code: string;
  name: string;
}

function getCurrencyOptions(locale: string): CurrencyOption[] {
  const codes =
    (
      Intl as unknown as { supportedValuesOf?: (k: string) => string[] }
    ).supportedValuesOf?.("currency") ?? [];
  const names = new Intl.DisplayNames([locale], { type: "currency" });
  return codes.map((code) => ({ code, name: names.of(code) ?? code }));
}

export function CurrencySelect({
  value,
  onChange,
  label,
  required,
  disabled,
}: Props) {
  const locale = useLocale();
  const tCommon = useTranslations("common");
  const options = useMemo(() => getCurrencyOptions(locale), [locale]);

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
        minContentWidth={280}
        isEmpty={options.length === 0}
        maxListHeight={280}
        trigger={
          <button
            type="button"
            disabled={disabled}
            className={cn(
              "flex items-center justify-between w-full rounded-lg border border-border-default bg-bg-input px-4 py-3 text-sm text-text-primary",
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
                <span className="font-medium w-12 shrink-0">{opt.code}</span>
                <span className="truncate text-text-muted">{opt.name}</span>
              </button>
            );
          });
        }}
      </SearchableDropdown>
    </div>
  );
}
