"use client";

import useSWR from "swr";
import type { VendorDashboard } from "@/types";
import { API } from "@/lib/api/routes";
import { useFlag } from "@/hooks/useFlag";

/**
 * Aggregated vendor-portal dashboard (KPIs, quote outcomes, awaiting RFQs).
 * The fetch is gated on the `vendorPortal` flag — the endpoint 403s when it's
 * off, so we pass a `null` SWR key to skip a guaranteed-403 request (same guard
 * as `useVendorRfqs`).
 */
export function useVendorDashboard() {
  const enabled = useFlag("vendorPortal");
  const { data, isLoading, error, mutate } = useSWR<VendorDashboard>(
    enabled ? API.vendorPortalDashboard() : null
  );
  return { dashboard: data, loading: isLoading, error: !!error, mutate };
}
