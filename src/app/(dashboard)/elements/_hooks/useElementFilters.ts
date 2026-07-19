"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo } from "react";
import type {
  ElementUnit,
  ElementType,
  ElementSortField,
  SortOrder,
} from "@/lib/validations";
import {
  ELEMENT_SORT_FIELDS,
  ELEMENT_TYPES,
  SORT_ORDERS,
} from "@/lib/validations";

const SORT_FIELDS = new Set<string>(ELEMENT_SORT_FIELDS);
const ORDERS = new Set<string>(SORT_ORDERS);
const TYPES = new Set<string>(ELEMENT_TYPES);

export interface ElementFilterState {
  search: string;
  categoryId: string | null;
  unit: ElementUnit | null;
  type: ElementType | null;
  isActive: boolean;
  sortBy: ElementSortField | null;
  sortOrder: SortOrder | null;
  page: number;
}

/** Reads filter state from the URL and provides setters that update the URL. */
export function useElementFilters() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const state: ElementFilterState = useMemo(() => {
    const sortBy = searchParams.get("sortBy");
    const sortOrder = searchParams.get("sortOrder");
    return {
      search: searchParams.get("search") ?? "",
      categoryId: searchParams.get("categoryId"),
      unit: (searchParams.get("unit") as ElementUnit | null) ?? null,
      type: (() => {
        const type = searchParams.get("type");
        return type && TYPES.has(type) ? (type as ElementType) : null;
      })(),
      isActive: searchParams.get("archived") !== "1",
      sortBy:
        sortBy && SORT_FIELDS.has(sortBy) ? (sortBy as ElementSortField) : null,
      sortOrder:
        sortOrder && ORDERS.has(sortOrder) ? (sortOrder as SortOrder) : null,
      page: Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1),
    };
  }, [searchParams]);

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
      router.replace(`/elements/library?${params.toString()}`, {
        scroll: false,
      });
    },
    [router, searchParams]
  );

  const setSort = useCallback(
    (sortBy: ElementSortField | null, sortOrder: SortOrder | null) => {
      const params = new URLSearchParams(searchParams.toString());
      if (sortBy && sortOrder) {
        params.set("sortBy", sortBy);
        params.set("sortOrder", sortOrder);
      } else {
        params.delete("sortBy");
        params.delete("sortOrder");
      }
      params.delete("page");
      router.replace(`/elements/library?${params.toString()}`, {
        scroll: false,
      });
    },
    [router, searchParams]
  );

  return {
    state,
    setSearch: (v: string) => setParam("search", v || null),
    setCategoryId: (v: string | null) => setParam("categoryId", v),
    setUnit: (v: ElementUnit | null) => setParam("unit", v),
    setType: (v: ElementType | null) => setParam("type", v),
    setShowArchived: (archived: boolean) =>
      setParam("archived", archived ? "1" : null),
    setSort,
    setPage: (page: number) => setParam("page", String(page)),
    clear: () => router.replace("/elements/library", { scroll: false }),
  };
}
