"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo } from "react";
import type { VendorStatus, VendorKycStatus } from "@/types";
import type { VendorSortField, SortOrder } from "@/lib/validations";
import {
  VENDOR_STATUSES,
  VENDOR_KYC_STATUSES,
  VENDOR_SORT_FIELDS,
  SORT_ORDERS,
} from "@/lib/validations";

export interface VendorFilterState {
  search: string;
  status: VendorStatus | null;
  kycStatus: VendorKycStatus | null;
  tradeCategoryId: string | null;
  preferred: boolean;
  sortBy: VendorSortField | null;
  sortOrder: SortOrder | null;
  page: number;
}

const STATUS_SET = new Set<string>(VENDOR_STATUSES);
const KYC_STATUS_SET = new Set<string>(VENDOR_KYC_STATUSES);
const SORT_FIELDS = new Set<string>(VENDOR_SORT_FIELDS);
const ORDERS = new Set<string>(SORT_ORDERS);

/** URL-driven filter state for the vendors list, mirrors the elements page pattern. */
export function useVendorFilters() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const state: VendorFilterState = useMemo(() => {
    const status = searchParams.get("status");
    const kycStatus = searchParams.get("kycStatus");
    const sortBy = searchParams.get("sortBy");
    const sortOrder = searchParams.get("sortOrder");
    return {
      search: searchParams.get("search") ?? "",
      status:
        status && STATUS_SET.has(status) ? (status as VendorStatus) : null,
      kycStatus:
        kycStatus && KYC_STATUS_SET.has(kycStatus)
          ? (kycStatus as VendorKycStatus)
          : null,
      tradeCategoryId: searchParams.get("tradeCategoryId"),
      preferred: searchParams.get("preferred") === "true",
      sortBy:
        sortBy && SORT_FIELDS.has(sortBy) ? (sortBy as VendorSortField) : null,
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
      router.replace(`/vendors?${params.toString()}`, { scroll: false });
    },
    [router, searchParams]
  );

  const setSort = useCallback(
    (sortBy: VendorSortField | null, sortOrder: SortOrder | null) => {
      const params = new URLSearchParams(searchParams.toString());
      if (sortBy && sortOrder) {
        params.set("sortBy", sortBy);
        params.set("sortOrder", sortOrder);
      } else {
        params.delete("sortBy");
        params.delete("sortOrder");
      }
      params.delete("page");
      router.replace(`/vendors?${params.toString()}`, { scroll: false });
    },
    [router, searchParams]
  );

  return {
    state,
    setSearch: (v: string) => setParam("search", v || null),
    setStatus: (v: VendorStatus | null) => setParam("status", v),
    setKycStatus: (v: VendorKycStatus | null) => setParam("kycStatus", v),
    setTradeCategoryId: (v: string | null) => setParam("tradeCategoryId", v),
    setPreferred: (v: boolean) => setParam("preferred", v ? "true" : null),
    setSort,
    setPage: (page: number) => setParam("page", String(page)),
    clear: () => router.replace("/vendors", { scroll: false }),
  };
}
