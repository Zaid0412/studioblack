"use client";

import { useMemo } from "react";
import useSWR from "swr";
import { API } from "@/lib/api/routes";
import type { Division } from "@/types";

/**
 * The org's BOQ division library. Shared by the org Settings manager and the
 * section's division picker. `enabledOnly` filters to divisions that can still
 * be assigned (a disabled division keeps its existing sections but isn't offered
 * for new ones). Pass `enabled: false` to hold the fetch while a dialog is shut.
 */
export function useDivisions(opts: { enabled?: boolean } = {}) {
  const { enabled = true } = opts;
  const { data, isLoading, mutate } = useSWR<{ divisions: Division[] }>(
    enabled ? API.divisions() : null
  );

  const divisions = useMemo(() => data?.divisions ?? [], [data?.divisions]);
  const enabledDivisions = useMemo(
    () => divisions.filter((d) => d.enabled),
    [divisions]
  );
  const byId = useMemo(
    () => new Map(divisions.map((d) => [d.id, d])),
    [divisions]
  );

  return {
    divisions,
    enabledDivisions,
    byId,
    isLoading,
    loaded: data !== undefined,
    mutate,
  };
}
