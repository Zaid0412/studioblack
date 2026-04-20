"use client";

import { useMemo, useState, useEffect, useRef } from "react";
import { Search, SearchX } from "lucide-react";
import { icons, type LucideIcon } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

const ICON_ENTRIES = Object.entries(icons) as [string, LucideIcon][];

/**
 * Word-level vocabulary pulled from lucide icon names — "ArrowUp" contributes
 * "arrow" and "up". Used to suggest real search terms when the user mistypes.
 */
const SEARCH_VOCABULARY: readonly string[] = Array.from(
  new Set(
    ICON_ENTRIES.flatMap(([name]) =>
      name
        .replace(/([A-Z0-9]+)/g, " $1")
        .trim()
        .toLowerCase()
        .split(/\s+/)
        .filter((w) => w.length >= 3)
    )
  )
);

/** Classic iterative Levenshtein distance (rows-only matrix, O(n*m) time, O(m) space). */
function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = new Array<number>(b.length + 1);
  let curr = new Array<number>(b.length + 1);
  for (let j = 0; j <= b.length; j++) prev[j] = j;
  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
    }
    [prev, curr] = [curr, prev];
  }
  return prev[b.length];
}

/**
 * Returns up to `limit` vocabulary terms closest to `query` by edit distance.
 * Looser threshold for longer queries: ceil(length / 3).
 */
function suggestSearches(query: string, limit = 3): string[] {
  const q = query.trim().toLowerCase();
  if (q.length < 2) return [];
  const threshold = Math.max(1, Math.ceil(q.length / 3));
  const scored: { term: string; distance: number }[] = [];
  for (const term of SEARCH_VOCABULARY) {
    const d = levenshtein(q, term);
    if (d <= threshold) scored.push({ term, distance: d });
  }
  scored.sort(
    (a, b) => a.distance - b.distance || a.term.length - b.term.length
  );
  const seen = new Set<string>();
  const out: string[] = [];
  for (const { term } of scored) {
    if (seen.has(term)) continue;
    seen.add(term);
    out.push(term);
    if (out.length === limit) break;
  }
  return out;
}

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** "BrickWall" → "Brick Wall", "Icon3D" → "Icon 3 D". */
const humanize = (name: string) => name.replace(/([A-Z0-9]+)/g, " $1").trim();

interface Props {
  open: boolean;
  value: string | null;
  color?: string | null;
  onOpenChange: (open: boolean) => void;
  onSelect: (name: string) => void;
}

/**
 * Dialog to browse the full lucide icon set with a debounced search.
 * Selecting an icon + clicking "Use icon" fires `onSelect(PascalCaseName)`.
 */
export function CategoryIconBrowseDialog({
  open,
  value,
  color,
  onOpenChange,
  onSelect,
}: Props) {
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [pending, setPending] = useState<string | null>(value);

  useEffect(() => {
    if (!open) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time sync: hydrate pending selection when dialog opens
    setPending(value);
  }, [open, value]);

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(
      () => setDebounced(query.trim().toLowerCase()),
      120
    );
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [query]);

  const filtered = useMemo(() => {
    if (!debounced) return ICON_ENTRIES.slice(0, 300);
    return ICON_ENTRIES.filter(([name]) =>
      name.toLowerCase().includes(debounced)
    ).slice(0, 600);
  }, [debounced]);

  const confirm = () => {
    if (pending) {
      onSelect(pending);
      onOpenChange(false);
    }
  };

  const SelectedIcon = pending
    ? (icons[pending as keyof typeof icons] as LucideIcon | undefined)
    : undefined;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Choose an icon</DialogTitle>
          <DialogDescription>
            {ICON_ENTRIES.length.toLocaleString()}+ icons from Lucide
          </DialogDescription>
        </DialogHeader>

        <div className="relative">
          <Search
            className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted"
            aria-hidden
          />
          <Input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search icons"
            className="pl-9"
          />
        </div>

        <div className="h-[360px] overflow-y-auto rounded-lg border border-border-default bg-bg-input p-2">
          {filtered.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
              <SearchX
                className="h-10 w-10 text-text-muted"
                aria-hidden
                strokeWidth={1.5}
              />
              <p className="text-sm font-medium text-text-primary">
                No icons match &ldquo;{query}&rdquo;
              </p>
              {(() => {
                const suggestions = suggestSearches(debounced);
                if (suggestions.length === 0) {
                  return (
                    <p className="text-xs text-text-muted">
                      Try a different search term
                    </p>
                  );
                }
                return (
                  <div className="flex flex-col items-center gap-2">
                    <p className="text-xs text-text-muted">Try one of these:</p>
                    <div className="flex flex-wrap items-center justify-center gap-1.5">
                      {suggestions.map((s) => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => setQuery(s)}
                          className="cursor-pointer rounded-full border border-border-default bg-bg-secondary px-3 py-1 text-xs text-text-secondary transition-colors hover:border-accent/60 hover:text-text-primary"
                        >
                          {capitalize(s)}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })()}
            </div>
          ) : (
            <div className="grid grid-cols-6 gap-2 sm:grid-cols-8">
              {filtered.map(([name, Icon]) => {
                const selected = pending === name;
                return (
                  <Tooltip key={name} delayDuration={300}>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        onClick={() => setPending(name)}
                        onDoubleClick={() => {
                          setPending(name);
                          onSelect(name);
                          onOpenChange(false);
                        }}
                        aria-label={name}
                        aria-pressed={selected}
                        className={cn(
                          "flex aspect-square cursor-pointer items-center justify-center rounded-md transition-all duration-150",
                          selected
                            ? "bg-accent/10 text-accent ring-2 ring-accent scale-105"
                            : "ring-1 ring-transparent text-text-secondary hover:ring-border-default hover:bg-bg-hover"
                        )}
                      >
                        <Icon
                          className="h-5 w-5"
                          style={color ? { color } : undefined}
                          aria-hidden
                        />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>{name}</TooltipContent>
                  </Tooltip>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex min-h-[52px] items-center gap-3 rounded-lg border border-border-default bg-bg-input px-3 py-2">
          {pending && SelectedIcon ? (
            <>
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-border-default bg-bg-secondary">
                <SelectedIcon
                  className="h-5 w-5"
                  style={color ? { color } : undefined}
                  aria-hidden
                />
              </div>
              <div className="flex min-w-0 flex-col">
                <span className="truncate text-sm font-medium text-text-primary">
                  {humanize(pending)}
                </span>
                <code className="truncate font-mono text-[11px] text-text-muted">
                  {pending}
                </code>
              </div>
            </>
          ) : (
            <span className="text-xs text-text-muted">
              Select an icon to see details
            </span>
          )}
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="secondary">
              Cancel
            </Button>
          </DialogClose>
          <Button type="button" onClick={confirm} disabled={!pending}>
            Use icon
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
