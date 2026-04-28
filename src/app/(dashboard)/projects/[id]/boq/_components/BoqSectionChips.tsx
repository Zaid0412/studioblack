"use client";

import { useEffect, useRef, useState } from "react";

export interface BoqChipDescriptor {
  id: string;
  title: string;
  itemCount: number;
}

interface BoqSectionChipsProps {
  chips: BoqChipDescriptor[];
  /**
   * Resolve the DOM element for a section by id. Used to scroll into view
   * and observe intersection. Returning `null` skips that chip's affordance.
   */
  getSectionEl: (sectionId: string) => HTMLElement | null;
  /** Called when a chip is clicked — used to expand a collapsed section. */
  onActivate?: (sectionId: string) => void;
}

/**
 * Sticky horizontal strip of section chips with element counts. Tracks the
 * section currently in view via IntersectionObserver and highlights its chip.
 * Click → smooth-scroll to that section.
 */
export function BoqSectionChips({
  chips,
  getSectionEl,
  onActivate,
}: BoqSectionChipsProps) {
  const [activeId, setActiveId] = useState<string | null>(chips[0]?.id ?? null);
  const stripRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observers: IntersectionObserver[] = [];
    const visible = new Set<string>();

    for (const chip of chips) {
      const el = getSectionEl(chip.id);
      if (!el) continue;
      const obs = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (entry.isIntersecting) visible.add(chip.id);
            else visible.delete(chip.id);
          }
          // Pick the first chip in declaration order whose section is visible.
          const next = chips.find((c) => visible.has(c.id))?.id ?? null;
          if (next) setActiveId(next);
        },
        // Trigger when the section header crosses the top half of the viewport.
        { rootMargin: "-30% 0px -60% 0px", threshold: 0 }
      );
      obs.observe(el);
      observers.push(obs);
    }

    return () => {
      for (const obs of observers) obs.disconnect();
    };
  }, [chips, getSectionEl]);

  // Keep the active chip horizontally in view as the user scrolls between
  // sections — otherwise long chip strips can leave the highlight off-screen.
  // Important: only scroll the strip horizontally. `el.scrollIntoView` walks
  // up scrollable ancestors and can scroll the page vertically when the
  // sticky strip leaves its sticky range near the end of the table — felt to
  // the user as a "bounce-back" while reading the last section.
  useEffect(() => {
    if (!activeId || !stripRef.current) return;
    const strip = stripRef.current;
    const el = strip.querySelector<HTMLButtonElement>(
      `[data-chip-id="${activeId}"]`
    );
    if (!el) return;
    const stripRect = strip.getBoundingClientRect();
    const elRect = el.getBoundingClientRect();
    const PADDING = 16;
    if (elRect.left < stripRect.left + PADDING) {
      strip.scrollBy({
        left: elRect.left - stripRect.left - PADDING,
        behavior: "smooth",
      });
    } else if (elRect.right > stripRect.right - PADDING) {
      strip.scrollBy({
        left: elRect.right - stripRect.right + PADDING,
        behavior: "smooth",
      });
    }
  }, [activeId]);

  if (chips.length === 0) return null;

  const handleClick = (chipId: string) => {
    onActivate?.(chipId);
    // Defer the scroll so a freshly-expanded section has a layout to scroll to.
    requestAnimationFrame(() => {
      const el = getSectionEl(chipId);
      el?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

  return (
    <div
      ref={stripRef}
      role="tablist"
      aria-label="BOQ sections"
      className="sticky top-0 z-10 flex gap-1.5 overflow-x-auto bg-bg-secondary/90 backdrop-blur px-3 py-2 border-b border-border-default no-scrollbar"
    >
      {chips.map((chip) => {
        const isActive = chip.id === activeId;
        return (
          <button
            key={chip.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            data-chip-id={chip.id}
            onClick={() => handleClick(chip.id)}
            className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs whitespace-nowrap transition-colors cursor-pointer ${
              isActive
                ? "bg-accent text-accent-foreground"
                : "bg-bg-elevated text-text-primary hover:bg-bg-elevated/80"
            }`}
          >
            <span className="font-medium">{chip.title}</span>
            <span
              className={`inline-flex items-center justify-center min-w-[18px] rounded-full px-1.5 text-[10px] font-semibold ${
                isActive
                  ? "bg-accent-foreground/20 text-accent-foreground"
                  : "bg-border-default text-text-muted"
              }`}
            >
              {chip.itemCount}
            </span>
          </button>
        );
      })}
    </div>
  );
}
