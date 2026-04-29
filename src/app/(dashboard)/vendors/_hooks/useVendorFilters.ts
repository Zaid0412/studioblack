"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo } from "react";
import type { VendorStatus, VendorKycStatus } from "@/types";
import { VENDOR_STATUSES, VENDOR_KYC_STATUSES } from "@/lib/validations";

export interface VendorFilterState {
  search: string;
  status: VendorStatus | null;
  kycStatus: VendorKycStatus | null;
  tradeCategoryId: string | null;
  page: number;
}

const STATUS_SET = new Set<string>(VENDOR_STATUSES);
const KYC_STATUS_SET = new Set<string>(VENDOR_KYC_STATUSES);

/** URL-driven filter state for the vendors list, mirrors the elements page pattern. */
export function useVendorFilters() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const state: VendorFilterState = useMemo(() => {
    const status = searchParams.get("status");
    const kycStatus = searchParams.get("kycStatus");
    return {
      search: searchParams.get("search") ?? "",
      status:
        status && STATUS_SET.has(status) ? (status as VendorStatus) : null,
      kycStatus:
        kycStatus && KYC_STATUS_SET.has(kycStatus)
          ? (kycStatus as VendorKycStatus)
          : null,
      tradeCategoryId: searchParams.get("tradeCategoryId"),
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

  return {
    state,
    setSearch: (v: string) => setParam("search", v || null),
    setStatus: (v: VendorStatus | null) => setParam("status", v),
    setKycStatus: (v: VendorKycStatus | null) => setParam("kycStatus", v),
    setTradeCategoryId: (v: string | null) => setParam("tradeCategoryId", v),
    setPage: (page: number) => setParam("page", String(page)),
    clear: () => router.replace("/vendors", { scroll: false }),
  };
}
