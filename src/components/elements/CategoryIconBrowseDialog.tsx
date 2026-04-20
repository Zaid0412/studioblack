"use client";

import { useMemo, useState, useEffect, useRef } from "react";
import { Search } from "lucide-react";
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
import { cn } from "@/lib/utils";

const ICON_ENTRIES = Object.entries(icons) as [string, LucideIcon][];

interface Props {
  open: boolean;
  value: string | null;
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

        <div className="max-h-[360px] overflow-y-auto rounded-lg border border-border-default bg-bg-input p-2">
          {filtered.length === 0 ? (
            <p className="py-8 text-center text-sm text-text-muted">
              No icons match &ldquo;{query}&rdquo;
            </p>
          ) : (
            <div className="grid grid-cols-6 gap-2 sm:grid-cols-8">
              {filtered.map(([name, Icon]) => {
                const selected = pending === name;
                return (
                  <button
                    key={name}
                    type="button"
                    onClick={() => setPending(name)}
                    onDoubleClick={() => {
                      setPending(name);
                      onSelect(name);
                      onOpenChange(false);
                    }}
                    title={name}
                    aria-label={name}
                    aria-pressed={selected}
                    className={cn(
                      "flex aspect-square items-center justify-center rounded-md border transition-colors",
                      selected
                        ? "border-accent bg-accent/10 text-accent"
                        : "border-transparent text-text-secondary hover:border-border-default hover:bg-bg-hover"
                    )}
                  >
                    <Icon className="h-5 w-5" aria-hidden />
                  </button>
                );
              })}
            </div>
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
