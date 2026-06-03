"use client";

import { usePathname } from "next/navigation";

export type ProjectTab = "designs" | "boq" | "order";

/**
 * Resolve the active project tab from the current pathname.
 *
 * `/projects/[id]/boq/...`   → `"boq"`
 * `/projects/[id]/order/...` → `"order"`
 * Anything else (including `/projects/[id]/designs/...`) → `"designs"`.
 */
export function useActiveProjectTab(projectId: string): ProjectTab {
  const pathname = usePathname();
  const boqPrefix = `/projects/${projectId}/boq`;
  const orderPrefix = `/projects/${projectId}/order`;
  if (pathname === boqPrefix || pathname.startsWith(`${boqPrefix}/`)) {
    return "boq";
  }
  if (pathname === orderPrefix || pathname.startsWith(`${orderPrefix}/`)) {
    return "order";
  }
  return "designs";
}
