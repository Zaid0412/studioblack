"use client";

import { useMemo, useState, type ReactNode } from "react";
import { Settings, Search, Check } from "lucide-react";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";

// ─── Section card ───────────────────────────────────────────────────────────

interface FieldCardProps {
  icon: React.ElementType;
  label: string;
  /** Trailing children render the displayed value (button-style, opens picker on click). */
  children?: ReactNode;
  /**
   * Picker content shown in the popover. Receives a `close` callback so the
   * picker can dismiss itself after a selection.
   */
  picker?: (close: () => void) => ReactNode;
  /** Override the popover width class. Default `w-72`. */
  popoverWidth?: string;
  /** Hide the gear icon (useful when there's no popover). */
  gearless?: boolean;
  divider?: boolean;
}

/**
 * Section row inside the metadata sidebar card. The label + gear icon at the
 * top open the same popover as clicking the displayed value below — so the
 * gear is a hint that the field is editable, but it's not the only target.
 */
export function FieldCard({
  icon: Icon,
  label,
  children,
  picker,
  popoverWidth = "w-72",
  gearless,
  divider,
}: FieldCardProps) {
  const [headerOpen, setHeaderOpen] = useState(false);
  const [bodyOpen, setBodyOpen] = useState(false);
  return (
    <section
      className={`px-4 py-3.5 ${divider ? "border-b border-border-default" : ""}`}
    >
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-1.5">
          <Icon className="w-3.5 h-3.5 text-text-muted" />
          <span className="text-[12px] font-semibold text-text-primary">
            {label}
          </span>
        </div>
        {!gearless && picker && (
          <Popover open={headerOpen} onOpenChange={setHeaderOpen}>
            <PopoverTrigger asChild>
              <button
                type="button"
                aria-label={`Edit ${label}`}
                className="p-0.5 rounded hover:bg-bg-elevated/60 text-text-muted hover:text-text-primary transition-colors cursor-pointer"
              >
                <Settings className="w-3.5 h-3.5" />
              </button>
            </PopoverTrigger>
            <PopoverContent
              align="end"
              className={`${popoverWidth} p-0 overflow-hidden`}
            >
              {picker(() => setHeaderOpen(false))}
            </PopoverContent>
          </Popover>
        )}
      </div>
      {picker ? (
        <Popover open={bodyOpen} onOpenChange={setBodyOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              className="w-full text-left rounded-md px-1 -mx-1 py-0.5 hover:bg-bg-elevated/40 transition-colors cursor-pointer"
            >
              {children}
            </button>
          </PopoverTrigger>
          <PopoverContent
            align="start"
            className={`${popoverWidth} p-0 overflow-hidden`}
          >
            {picker(() => setBodyOpen(false))}
          </PopoverContent>
        </Popover>
      ) : (
        children
      )}
    </section>
  );
}

// ─── Picker panel (search + scrollable list) ───────────────────────────────

interface PickerPanelProps<T> {
  title?: string;
  searchPlaceholder?: string;
  searchKeys?: (option: T) => (string | undefined | null)[];
  options: readonly T[];
  getKey: (option: T) => string;
  isSelected: (option: T) => boolean;
  onSelect: (option: T) => void;
  renderOption: (option: T) => ReactNode;
  emptyHint?: string;
}

/** GH-style picker panel — title + optional search + scrollable list. */
export function PickerPanel<T>({
  title,
  searchPlaceholder,
  searchKeys,
  options,
  getKey,
  isSelected,
  onSelect,
  renderOption,
  emptyHint,
}: PickerPanelProps<T>) {
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => {
    if (!query.trim() || !searchKeys) return options;
    const q = query.trim().toLowerCase();
    return options.filter((o) =>
      searchKeys(o).some((s) => s?.toLowerCase().includes(q))
    );
  }, [options, query, searchKeys]);

  return (
    <div className="flex flex-col">
      {title && (
        <div className="px-3 pt-3 pb-2 border-b border-border-default text-[11px] font-semibold text-text-muted uppercase tracking-wider">
          {title}
        </div>
      )}
      {searchKeys && (
        <div className="px-2 py-2 border-b border-border-default">
          <div className="flex items-center gap-2 px-2 py-1.5 rounded-md bg-bg-input border border-border-default focus-within:border-accent transition-colors">
            <Search className="w-3.5 h-3.5 text-text-muted shrink-0" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={searchPlaceholder}
              autoFocus
              className="flex-1 bg-transparent text-sm text-text-primary placeholder:text-text-muted outline-none"
            />
          </div>
        </div>
      )}
      <ul className="max-h-72 overflow-y-auto py-1">
        {filtered.length === 0 ? (
          <li className="px-3 py-3 text-xs text-text-muted">
            {query ? `No matches for "${query}"` : (emptyHint ?? "No options")}
          </li>
        ) : (
          filtered.map((option) => {
            const selected = isSelected(option);
            return (
              <li key={getKey(option)}>
                <button
                  type="button"
                  onClick={() => onSelect(option)}
                  className={`w-full flex items-center gap-2 px-3 py-2 text-left transition-colors ${
                    selected
                      ? "bg-accent/10"
                      : "hover:bg-bg-elevated/60 cursor-pointer"
                  }`}
                >
                  <Check
                    className={`w-3.5 h-3.5 shrink-0 ${
                      selected ? "text-accent" : "text-transparent"
                    }`}
                  />
                  <div className="flex-1 min-w-0">{renderOption(option)}</div>
                </button>
              </li>
            );
          })
        )}
      </ul>
    </div>
  );
}

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Tailwind classes for a priority pill. */
export function priorityClass(priority: string): string {
  switch (priority) {
    case "urgent":
      return "bg-red-500/10 text-red-500";
    case "high":
      return "bg-warning/10 text-warning";
    case "medium":
      return "bg-info/10 text-info";
    case "low":
      return "bg-text-muted/15 text-text-muted";
    default:
      return "bg-info/10 text-info";
  }
}
