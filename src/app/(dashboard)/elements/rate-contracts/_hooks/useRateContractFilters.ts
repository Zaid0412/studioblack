"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo } from "react";
import {
  RATE_CONTRACT_STATUSES,
  RATE_CONTRACT_SORT_FIELDS,
  SORT_ORDERS,
  type RateContractStatus,
  type RateContractSortField,
  type SortOrder,
} from "@/lib/validations";

const STATUS_SET = new Set<string>(RATE_CONTRACT_STATUSES);
const SORT_FIELDS = new Set<string>(RATE_CONTRACT_SORT_FIELDS);
const ORDERS = new Set<string>(SORT_ORDERS);

export interface RateContractFilterState {
  search: string;
  status: RateContractStatus | null;
  vendorId: string | null;
  sortBy: RateContractSortField | null;
  sortOrder: SortOrder | null;
  page: number;
}

const ROUTE = "/elements/rate-contracts";

/** URL-driven filter + sort state for the rate-contracts list page. */
export function useRateContractFilters() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const state: RateContractFilterState = useMemo(() => {
    const status = searchParams.get("status");
    const sortBy = searchParams.get("sortBy");
    const sortOrder = searchParams.get("sortOrder");
    return {
      search: searchParams.get("search") ?? "",
      status:
        status && STATUS_SET.has(status)
          ? (status as RateContractStatus)
          : null,
      vendorId: searchParams.get("vendorId"),
      sortBy:
        sortBy && SORT_FIELDS.has(sortBy)
          ? (sortBy as RateContractSortField)
          : null,
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
      if (key !== "page") params.delete("page");
      router.replace(`${ROUTE}?${params.toString()}`, { scroll: false });
    },
    [router, searchParams]
  );

  const setSort = useCallback(
    (sortBy: RateContractSortField | null, sortOrder: SortOrder | null) => {
      const params = new URLSearchParams(searchParams.toString());
      if (sortBy && sortOrder) {
        params.set("sortBy", sortBy);
        params.set("sortOrder", sortOrder);
      } else {
        params.delete("sortBy");
        params.delete("sortOrder");
      }
      params.delete("page");
      router.replace(`${ROUTE}?${params.toString()}`, { scroll: false });
    },
    [router, searchParams]
  );

  return {
    state,
    setSearch: (v: string) => setParam("search", v || null),
    setStatus: (v: string | null) => setParam("status", v),
    setVendorId: (v: string | null) => setParam("vendorId", v),
    setSort,
    setPage: (page: number) => setParam("page", String(page)),
    clear: () => router.replace(ROUTE, { scroll: false }),
  };
}
