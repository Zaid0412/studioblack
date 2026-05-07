"use client";

import { usePathname } from "next/navigation";

export type ProjectTab = "designs" | "boq";

/**
 * Resolve the active project tab from the current pathname.
 *
 * `/projects/[id]/boq/...` → `"boq"`. Anything else (including
 * `/projects/[id]/designs/...`) → `"designs"`.
 */
export function useActiveProjectTab(projectId: string): ProjectTab {
  const pathname = usePathname();
  const boqPrefix = `/projects/${projectId}/boq`;
  if (pathname === boqPrefix || pathname.startsWith(`${boqPrefix}/`)) {
    return "boq";
  }
  return "designs";
}
