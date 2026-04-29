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
  // Read latest `chips` inside the observer callback without re-depending on
  // the chips array itself — otherwise every BOQ mutation (item add/edit)
  // would rebuild N IntersectionObservers even when section IDs haven't moved.
  // The dep-less effect is intentional: keep `chipsRef.current` in sync with
  // the latest render so observer callbacks (which fire later, on scroll) see
  // current data.
  const chipsRef = useRef(chips);
  useEffect(() => {
    chipsRef.current = chips;
  });
  const sectionIdSignature = chips.map((c) => c.id).join("|");

  useEffect(() => {
    const observers: IntersectionObserver[] = [];
    const visible = new Set<string>();

    for (const chip of chipsRef.current) {
      const el = getSectionEl(chip.id);
      if (!el) continue;
      const obs = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (entry.isIntersecting) visible.add(chip.id);
            else visible.delete(chip.id);
          }
          const next =
            chipsRef.current.find((c) => visible.has(c.id))?.id ?? null;
          if (next) setActiveId(next);
        },
        // Trigger band: a thin slice in the upper third of the viewport.
        { rootMargin: "-30% 0px -60% 0px", threshold: 0 }
      );
      obs.observe(el);
      observers.push(obs);
    }

    return () => {
      for (const obs of observers) obs.disconnect();
    };
  }, [sectionIdSignature, getSectionEl]);

  // Manual horizontal scroll — `el.scrollIntoView` walks up scrollable
  // ancestors and yanks the document upward when the sticky strip nears the
  // end of its sticky range, so we never call it on a chip.
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
