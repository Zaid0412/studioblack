"use client";

import { useCallback } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

export type ProjectTab = "designs" | "boq";

/** Parse the `?tab=` search param into a `ProjectTab`, defaulting to "designs". */
export function parseProjectTab(value: string | null): ProjectTab {
  return value === "boq" ? "boq" : "designs";
}

/**
 * URL-driven tab state for the project detail page. Updates the `?tab=`
 * search param via `router.replace` with `scroll: false` so the view
 * doesn't jump when switching tabs.
 */
export function useProjectTabNav(activeTab: ProjectTab) {
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

  return { setTab };
}
