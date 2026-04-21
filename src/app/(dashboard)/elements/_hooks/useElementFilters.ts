"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo } from "react";
import type { ElementUnit } from "@/lib/validations";

export interface ElementFilterState {
  search: string;
  categoryId: string | null;
  unit: ElementUnit | null;
  isActive: boolean;
  page: number;
}

/** Reads filter state from the URL and provides setters that update the URL. */
export function useElementFilters() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const state: ElementFilterState = useMemo(
    () => ({
      search: searchParams.get("search") ?? "",
      categoryId: searchParams.get("categoryId"),
      unit: (searchParams.get("unit") as ElementUnit | null) ?? null,
      isActive: searchParams.get("archived") !== "1",
      page: Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1),
    }),
    [searchParams]
  );

  const setParam = useCallback(
    (key: string, value: string | null) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value === null || value === "") {
        params.delete(key);
      } else {
        params.set(key, value);
      }
      // Reset page whenever any other filter changes
      if (key !== "page") params.delete("page");
      router.replace(`/elements?${params.toString()}`, { scroll: false });
    },
    [router, searchParams]
  );

  return {
    state,
    setSearch: (v: string) => setParam("search", v || null),
    setCategoryId: (v: string | null) => setParam("categoryId", v),
    setUnit: (v: ElementUnit | null) => setParam("unit", v),
    setShowArchived: (archived: boolean) =>
      setParam("archived", archived ? "1" : null),
    setPage: (page: number) => setParam("page", String(page)),
    clear: () => router.replace("/elements", { scroll: false }),
  };
}
