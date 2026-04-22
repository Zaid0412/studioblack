"use client";

import { useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Check, ChevronDown, Search } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
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
    (Intl as unknown as { supportedValuesOf?: (k: string) => string[] })
      .supportedValuesOf?.("currency") ?? [];
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
  const t = useTranslations("common");
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const options = useMemo(() => getCurrencyOptions(locale), [locale]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter(
      (o) =>
        o.code.toLowerCase().includes(q) || o.name.toLowerCase().includes(q)
    );
  }, [options, query]);

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
      <Popover
        open={open}
        onOpenChange={(o) => {
          setOpen(o);
          if (!o) setQuery("");
        }}
      >
        <PopoverTrigger asChild>
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
        </PopoverTrigger>
        <PopoverContent
          align="start"
          className="w-[var(--radix-popover-trigger-width)] min-w-[280px] p-0"
        >
          <div className="flex flex-col">
            <div className="relative">
              <Search
                className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-muted"
                aria-hidden
              />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t("search")}
                className="w-full bg-transparent pl-9 pr-3 py-2 text-sm text-text-primary placeholder:text-text-muted outline-none border-b border-border-default"
                style={{ outline: "none" }}
                autoFocus
              />
            </div>
            <div
              className="max-h-[280px] overflow-y-auto py-1"
              onWheel={(e) => {
                e.currentTarget.scrollTop += e.deltaY;
              }}
            >
              {filtered.length === 0 ? (
                <p className="px-3 py-4 text-sm text-text-muted text-center">
                  {t("noResults")}
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
                        setOpen(false);
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
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
