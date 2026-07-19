"use client";

import { usePathname } from "next/navigation";

export type ProjectTab = "overview" | "designs" | "boq" | "order";

/**
 * Resolve the active project tab from the current pathname.
 *
 * `/projects/[id]`           → `"overview"` (the project home)
 * `/projects/[id]/boq/...`   → `"boq"`
 * `/projects/[id]/order/...` → `"order"`
 * Anything else (including `/projects/[id]/designs/...`) → `"designs"`.
 */
export function useActiveProjectTab(projectId: string): ProjectTab {
  const pathname = usePathname();
  const base = `/projects/${projectId}`;
  const boqPrefix = `${base}/boq`;
  const orderPrefix = `${base}/order`;
  if (pathname === boqPrefix || pathname.startsWith(`${boqPrefix}/`)) {
    return "boq";
  }
  if (pathname === orderPrefix || pathname.startsWith(`${orderPrefix}/`)) {
    return "order";
  }
  if (pathname === base) {
    return "overview";
  }
  return "designs";
}
