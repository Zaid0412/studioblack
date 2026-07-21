"use client";

import { useState, useMemo, useCallback } from "react";
import {
  nextSortDirection,
  type SortConfig,
} from "@/components/ui/SortableHeader";

export type FilterTab = "all" | "active" | "completed" | "draft";

/** Fields the desktop table sorts by via clickable column headers. */
export type ProjectSortField =
  | "name"
  | "client"
  | "category"
  | "status"
  | "estimate"
  | "updated";

const PAGE_SIZE = 10;

/** Default search predicate — matches project name (case-insensitive). */
function defaultSearch<T extends ProjectListItem>(item: T, query: string) {
  return item.name.toLowerCase().includes(query.toLowerCase());
}

/** "client_name, else client_email, else empty" — the value shown and sorted. */
export function clientLabel(p: ProjectListItem): string {
  return p.client_name || p.client_email || "";
}

/** Recency key: last update, falling back to creation. */
function updatedAtMs(p: ProjectListItem): number {
  return new Date(p.updated_at || p.created_at).getTime();
}

/** Ascending comparison for a sortable column; caller negates for descending. */
function compareProjects(
  a: ProjectListItem,
  b: ProjectListItem,
  field: ProjectSortField
): number {
  switch (field) {
    case "client":
      return clientLabel(a).localeCompare(clientLabel(b));
    case "category":
      return (a.category ?? "").localeCompare(b.category ?? "");
    case "status":
      return a.status.localeCompare(b.status);
    case "estimate":
      return Number(a.estimation_inr ?? 0) - Number(b.estimation_inr ?? 0);
    case "updated":
      return updatedAtMs(a) - updatedAtMs(b);
    default: // name
      return a.name.localeCompare(b.name);
  }
}

/** Minimal shape a project item must satisfy for filtering/sorting/pagination. */
export interface ProjectListItem {
  name: string;
  status: string;
  created_at: string;
  updated_at?: string | null;
  // Optional fields the column-header sort reads (all present on DbProjectRow).
  client_name?: string | null;
  client_email?: string | null;
  category?: string | null;
  estimation_inr?: number | string | null;
}

interface UseProjectListOptions<T extends ProjectListItem> {
  /** Items to filter/sort/paginate. */
  items: T[];
  /** Optional custom search predicate. Defaults to name-only search. */
  searchFilter?: (item: T, query: string) => boolean;
}

/**
 * Shared filtering, sorting, and pagination logic for project list pages.
 * Keeps rendering concerns in the consumer components.
 */
export function useProjectList<T extends ProjectListItem>({
  items,
  searchFilter,
}: UseProjectListOptions<T>) {
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState<FilterTab>("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortBy, setSortByState] = useState("newest");
  const [columnSort, setColumnSort] =
    useState<SortConfig<ProjectSortField>>(null);
  const [currentPage, setCurrentPage] = useState(1);

  // The dropdown and the clickable column headers are independent controls over
  // one sorted list — last action wins. Picking a dropdown preset clears any
  // active column sort so the preset takes effect; clicking a header sets the
  // column sort, which then takes precedence until it cycles back to unsorted.
  const setSortBy = useCallback((value: string) => {
    setSortByState(value);
    setColumnSort(null);
  }, []);

  const toggleColumnSort = useCallback(
    (field: ProjectSortField) =>
      setColumnSort((cur) => nextSortDirection(cur, field)),
    []
  );

  const matchSearch = searchFilter ?? defaultSearch;

  const filtered = useMemo(() => {
    const list = items.filter((p) => {
      const matchesSearch = matchSearch(p, search);
      const matchesTab = activeFilter === "all" || p.status === activeFilter;
      const matchesStatus = statusFilter === "all" || p.status === statusFilter;
      return matchesSearch && matchesTab && matchesStatus;
    });

    return [...list].sort((a, b) => {
      if (columnSort) {
        const cmp = compareProjects(a, b, columnSort.key);
        return columnSort.direction === "asc" ? cmp : -cmp;
      }
      switch (sortBy) {
        case "oldest":
          return (
            new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
          );
        case "name":
          return a.name.localeCompare(b.name);
        case "updated":
          return updatedAtMs(b) - updatedAtMs(a);
        default: // newest
          return (
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
          );
      }
    });
  }, [
    items,
    search,
    activeFilter,
    statusFilter,
    sortBy,
    columnSort,
    matchSearch,
  ]);

  // Reset page when filters change (inline to avoid cascading renders)
  const columnSortKey = columnSort
    ? `${columnSort.key}:${columnSort.direction}`
    : "";
  const filterKey = `${search}|${activeFilter}|${statusFilter}|${sortBy}|${columnSortKey}`;
  const [prevFilterKey, setPrevFilterKey] = useState(filterKey);
  if (filterKey !== prevFilterKey) {
    setPrevFilterKey(filterKey);
    if (currentPage !== 1) setCurrentPage(1);
  }

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const startIdx = (currentPage - 1) * PAGE_SIZE;
  const endIdx = Math.min(startIdx + PAGE_SIZE, filtered.length);
  const paginatedRows = filtered.slice(startIdx, endIdx);
  const activeTabCount = filtered.length;

  return {
    // State
    search,
    setSearch,
    activeFilter,
    setActiveFilter,
    statusFilter,
    setStatusFilter,
    sortBy,
    setSortBy,
    columnSort,
    toggleColumnSort,
    currentPage,
    setCurrentPage,
    // Derived
    filtered,
    paginatedRows,
    totalPages,
    startIdx,
    endIdx,
    activeTabCount,
  } as const;
}
