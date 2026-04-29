"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo } from "react";
import { BOQ_ITEM_SOURCES, type BoqItemSource } from "@/lib/validations";

const PARAM = "source";
const VALID = new Set<BoqItemSource>(BOQ_ITEM_SOURCES);

/**
 * URL-driven multi-select for the BOQ row provenance filter. Comma-separated
 * `?source=library,custom`. Empty / missing param → no filter (show all).
 * Unknown values are silently dropped, so an old bookmarked URL with a stale
 * source name doesn't crash the page.
 */
export function useBoqSourceFilter() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const selected = useMemo<Set<BoqItemSource>>(() => {
    const raw = searchParams.get(PARAM);
    if (!raw) return new Set();
    const next = new Set<BoqItemSource>();
    for (const value of raw.split(",")) {
      const trimmed = value.trim();
      if (VALID.has(trimmed as BoqItemSource)) {
        next.add(trimmed as BoqItemSource);
      }
    }
    return next;
  }, [searchParams]);

  const setSelected = useCallback(
    (next: Set<BoqItemSource>) => {
      const params = new URLSearchParams(searchParams.toString());
      if (next.size === 0) {
        params.delete(PARAM);
      } else {
        // Stable ordering matches BOQ_ITEM_SOURCES so the URL doesn't churn
        // when the same set is re-applied via different click orders.
        const ordered = BOQ_ITEM_SOURCES.filter((s) => next.has(s));
        params.set(PARAM, ordered.join(","));
      }
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [router, pathname, searchParams]
  );

  return { selected, setSelected };
}
