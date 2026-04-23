"use client";

import { useCallback } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

export type ProjectTab = "designs" | "boq";

const TABS: ReadonlyArray<{ id: ProjectTab; label: string }> = [
  { id: "designs", label: "Designs" },
  { id: "boq", label: "BOQ" },
];

interface ProjectTabsProps {
  activeTab: ProjectTab;
}

/**
 * Horizontal tab bar on the project detail page. Tab state is URL-driven
 * (`?tab=designs|boq`) so it survives reloads and supports deep links from
 * notifications.
 */
export function ProjectTabs({ activeTab }: ProjectTabsProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const setTab = useCallback(
    (tab: ProjectTab) => {
      if (tab === activeTab) return;
      const params = new URLSearchParams(searchParams.toString());
      if (tab === "designs") params.delete("tab");
      else params.set("tab", tab);
      const qs = params.toString();
      router.replace(`${pathname}${qs ? `?${qs}` : ""}`, { scroll: false });
    },
    [activeTab, pathname, router, searchParams]
  );

  return (
    <div className="shrink-0 px-4 lg:px-10 pt-4">
      <div className="flex gap-1 border-b border-border-default">
        {TABS.map((tab) => {
          const isActive = tab.id === activeTab;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setTab(tab.id)}
              className={`relative px-4 py-2.5 text-sm font-medium transition-colors cursor-pointer ${
                isActive
                  ? "text-text-primary"
                  : "text-text-muted hover:text-text-secondary"
              }`}
            >
              {tab.label}
              <span
                className={`absolute bottom-0 left-0 right-0 h-[2px] bg-accent transition-opacity ${
                  isActive ? "opacity-100" : "opacity-0"
                }`}
              />
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** Parse the `?tab=` search param into a `ProjectTab`, defaulting to "designs". */
export function parseProjectTab(value: string | null): ProjectTab {
  return value === "boq" ? "boq" : "designs";
}
