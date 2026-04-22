"use client";

import { useMemo, useState, type ReactNode, type WheelEvent } from "react";
import { useTranslations } from "next-intl";
import { Search } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface SearchableDropdownProps {
  trigger: ReactNode;
  /**
   * Rendered above the search input — e.g. a "Create new" button.
   * Stays visible across filter changes. Receives `close()` so custom
   * actions (like opening another dialog) can dismiss the popover.
   */
  headerSlot?: ReactNode | ((close: () => void) => ReactNode);
  /**
   * Called with the lowercased, trimmed query string and a `close()`
   * callback. Parent owns filtering and decides when selections should
   * dismiss the popover.
   */
  children: (query: string, close: () => void) => ReactNode;
  /** When true, render the empty state instead of `children`. */
  isEmpty: boolean;
  emptyLabel?: string;
  minContentWidth?: number;
  maxListHeight?: number;
  align?: "start" | "center" | "end";
}

/**
 * Shared Popover + search + scroll shell for searchable dropdowns.
 *
 * Two Dialog-inside quirks are handled here:
 *   1. `react-remove-scroll` (pulled in by Radix Dialog) cancels wheel
 *      events on popovers portaled to `document.body`. We imperatively
 *      scroll on wheel so trackpads and mousewheels still work.
 *   2. `deltaMode` varies across browsers/devices — pixel, line, or
 *      page. We normalize to pixels to avoid barely-moving scroll in
 *      Firefox line mode.
 */
export function SearchableDropdown({
  trigger,
  headerSlot,
  children,
  isEmpty,
  emptyLabel,
  minContentWidth = 260,
  maxListHeight = 280,
  align = "start",
}: SearchableDropdownProps) {
  const t = useTranslations("common");
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const normalizedQuery = useMemo(() => query.trim().toLowerCase(), [query]);
  const close = () => setOpen(false);

  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) setQuery("");
      }}
    >
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent
        align={align}
        className="w-[var(--radix-popover-trigger-width)] p-0"
        style={{ minWidth: minContentWidth }}
      >
        <div className="flex flex-col">
          {typeof headerSlot === "function" ? headerSlot(close) : headerSlot}
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
              autoFocus
            />
          </div>
          <div
            className="overflow-y-auto py-1"
            style={{ maxHeight: maxListHeight }}
            onWheel={handleWheelScroll}
          >
            {isEmpty ? (
              <p className="px-3 py-4 text-sm text-text-muted text-center">
                {emptyLabel ?? t("noResults")}
              </p>
            ) : (
              children(normalizedQuery, close)
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

/**
 * Imperative wheel handler that converts line/page deltas to pixels and
 * bypasses `react-remove-scroll`'s cancelled default. Exported for any
 * picker that manages its own scroll container outside this primitive.
 */
export function handleWheelScroll(e: WheelEvent<HTMLElement>) {
  const LINE_PX = 16;
  const px =
    e.deltaMode === 1
      ? e.deltaY * LINE_PX
      : e.deltaMode === 2
        ? e.deltaY * e.currentTarget.clientHeight
        : e.deltaY;
  e.currentTarget.scrollTop += px;
}
