"use client";

import type { LucideIcon } from "lucide-react";

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
  return (
    <div className="flex items-center gap-0.5 p-0.5 rounded-lg bg-bg-input">
      {tabs.map(({ key, label, Icon, count }) => {
        const isActive = active === key;
        return (
          <button
            key={key}
            onClick={() => onSelect(key)}
            aria-pressed={isActive}
            className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[12px] font-medium transition-colors cursor-pointer ${
              isActive
                ? "bg-accent text-text-on-accent"
                : "text-text-secondary hover:text-text-primary"
            }`}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
            {count ? (
              <span
                className={`flex items-center justify-center min-w-4 h-4 px-1 rounded-full text-[10px] font-bold ${
                  isActive
                    ? "bg-text-on-accent/15 text-text-on-accent"
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
