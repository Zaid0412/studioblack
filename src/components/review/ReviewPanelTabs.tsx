"use client";

import { useRef } from "react";
import type { LucideIcon } from "lucide-react";
import { useSlidingIndicator } from "@/hooks/useSlidingIndicator";
import { SlidingIndicator } from "@/components/ui/SlidingIndicator";

export type ReviewPanelKey = "comments" | "reviews" | "revisions";

export interface ReviewPanelTab {
  key: ReviewPanelKey;
  label: string;
  Icon: LucideIcon;
  /** Optional count shown as a small pill (omitted/0 → no pill). */
  count?: number;
}

/**
 * Segmented control for the review side panels (Comments / Reviews / Revisions).
 * The panels are mutually exclusive, so a single labeled segmented control reads
 * clearer than three separate icon toggles. Clicking the active tab closes it.
 * The active-tab highlight slides between segments (`useSlidingIndicator`).
 */
export function ReviewPanelTabs({
  tabs,
  active,
  onSelect,
}: {
  tabs: ReviewPanelTab[];
  active: ReviewPanelKey | null;
  onSelect: (key: ReviewPanelKey) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const indicator = useSlidingIndicator(containerRef, active);

  return (
    <div
      ref={containerRef}
      className="relative flex items-center gap-0.5 rounded-lg bg-bg-input p-0.5"
    >
      {/* Accent-tint pill that slides behind the active tab. A tint (not solid
          accent) keeps the accent-coloured label legible over the dark track
          while the pill is mid-slide. */}
      <SlidingIndicator style={indicator} className="rounded-md bg-accent/15" />
      {tabs.map(({ key, label, Icon, count }) => {
        const isActive = active === key;
        return (
          <button
            key={key}
            data-active={isActive}
            onClick={() => onSelect(key)}
            aria-pressed={isActive}
            className={`relative z-10 flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[12px] font-medium transition-colors cursor-pointer ${
              isActive
                ? "text-accent"
                : "text-text-secondary hover:text-text-primary"
            }`}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
            {count ? (
              <span
                className={`flex items-center justify-center min-w-4 h-4 px-1 rounded-full text-[10px] font-bold ${
                  isActive
                    ? "bg-accent/20 text-accent"
                    : "bg-bg-elevated text-text-secondary"
                }`}
              >
                {count}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
