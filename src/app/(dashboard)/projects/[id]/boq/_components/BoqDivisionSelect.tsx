"use client";

import { Check, ChevronDown } from "lucide-react";
import { SearchableDropdown } from "@/components/ui/SearchableDropdown";
import { cn } from "@/lib/utils";
import { useDivisions } from "@/hooks/useDivisions";
import type { Division } from "@/types";

/**
 * Searchable division picker. Offers the enabled divisions from the org library
 * (filter by code or name). A section/item already filed under a now-disabled
 * division still shows it, so editing an unrelated field doesn't silently drop
 * it.
 *
 * Two modes:
 * - Section dialogs (default) — division is optional, so a "No division" option
 *   is offered and `onChange(null)` can fire.
 * - `required` (BOQ item) — division is mandatory, so there's no "No division"
 *   option and `onChange` only ever fires with a real id.
 *
 * Pass `label` to render an own label + `flex-col` wrapper (matching the sibling
 * field controls). Without it the bare dropdown is returned, so callers that
 * already wrap it in their own `<label>` (the section dialog) aren't double-labelled.
 */
export function BoqDivisionSelect({
  value,
  onChange,
  required = false,
  label,
}: {
  value: string | null;
  onChange: (divisionId: string | null) => void;
  required?: boolean;
  label?: string;
}) {
  const { enabledDivisions, byId } = useDivisions();

  // Keep a disabled-but-assigned division selectable/visible.
  const options: Division[] = [...enabledDivisions];
  if (value && !options.some((d) => d.id === value)) {
    const current = byId.get(value);
    if (current) options.push(current);
  }

  const selected = value ? byId.get(value) : null;
  const selectedLabel = selected
    ? `${selected.code} — ${selected.name}`
    : required
      ? "Select a division…"
      : "No division";

  const dropdown = (
    <SearchableDropdown
      minContentWidth={280}
      maxListHeight={240}
      isEmpty={false}
      trigger={
        <button
          type="button"
          className={cn(
            "flex w-full items-center justify-between rounded-lg border border-border-default bg-bg-input px-3 py-2.5 text-sm text-text-primary",
            "focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/30"
          )}
        >
          <span className="truncate">{selectedLabel}</span>
          <ChevronDown className="h-4 w-4 shrink-0 text-text-muted" />
        </button>
      }
    >
      {(query, close) => {
        const filtered = query
          ? options.filter(
              (d) =>
                d.code.toLowerCase().includes(query) ||
                d.name.toLowerCase().includes(query)
            )
          : options;
        const showNone = !required && (!query || "no division".includes(query));
        return (
          <>
            {showNone && (
              <button
                type="button"
                onClick={() => {
                  onChange(null);
                  close();
                }}
                className={cn(
                  "flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-bg-elevated",
                  value === null && "text-accent"
                )}
              >
                <span className="w-4 shrink-0">
                  {value === null && <Check className="h-4 w-4" />}
                </span>
                <span className="italic text-text-muted">No division</span>
              </button>
            )}
            {filtered.length === 0 && !showNone ? (
              <p className="px-3 py-4 text-center text-sm text-text-muted">
                No matches
              </p>
            ) : (
              filtered.map((d) => {
                const isSelected = value === d.id;
                return (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => {
                      onChange(d.id);
                      close();
                    }}
                    className={cn(
                      "flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-bg-elevated",
                      isSelected && "text-accent"
                    )}
                  >
                    <span className="w-4 shrink-0">
                      {isSelected && <Check className="h-4 w-4" />}
                    </span>
                    <span className="font-mono text-xs text-text-muted">
                      {d.code}
                    </span>
                    <span className="truncate">{d.name}</span>
                    {!d.enabled && (
                      <span className="ml-auto text-[10px] uppercase tracking-wide text-text-muted">
                        disabled
                      </span>
                    )}
                  </button>
                );
              })
            )}
          </>
        );
      }}
    </SearchableDropdown>
  );

  if (!label) return dropdown;
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-text-secondary">
        {label}
        {required && (
          <span className="text-danger" aria-hidden>
            {" "}
            *
          </span>
        )}
      </span>
      {dropdown}
    </div>
  );
}
