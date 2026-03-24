"use client";

import { useState, useMemo } from "react";

export type FilterTab = "all" | "active" | "completed" | "draft";

const PAGE_SIZE = 10;

/** Default search predicate — matches project name (case-insensitive). */
function defaultSearch<T extends ProjectListItem>(item: T, query: string) {
  return item.name.toLowerCase().includes(query.toLowerCase());
}

/** Minimal shape a project item must satisfy for filtering/sorting/pagination. */
export interface ProjectListItem {
  name: string;
  status: string;
  created_at: string;
  updated_at?: string | null;
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
  const [sortBy, setSortBy] = useState("newest");
  const [currentPage, setCurrentPage] = useState(1);

  const matchSearch = searchFilter ?? defaultSearch;

  const filtered = useMemo(() => {
    const list = items.filter((p) => {
      const matchesSearch = matchSearch(p, search);
      const matchesTab = activeFilter === "all" || p.status === activeFilter;
      const matchesStatus = statusFilter === "all" || p.status === statusFilter;
      return matchesSearch && matchesTab && matchesStatus;
    });

    list.sort((a, b) => {
      switch (sortBy) {
        case "oldest":
          return (
            new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
          );
        case "name":
          return a.name.localeCompare(b.name);
        case "updated":
          return (
            new Date(b.updated_at || b.created_at).getTime() -
            new Date(a.updated_at || a.created_at).getTime()
          );
        default: // newest
          return (
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
          );
      }
    });

    return list;
  }, [items, search, activeFilter, statusFilter, sortBy, matchSearch]);

  // Reset page when filters change (inline to avoid cascading renders)
  const filterKey = `${search}|${activeFilter}|${statusFilter}|${sortBy}`;
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
