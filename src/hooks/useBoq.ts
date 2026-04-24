"use client";

import useSWR from "swr";
import { API } from "@/lib/api/routes";
import { ApiError, apiGet } from "@/lib/api/client";
import { toast } from "@/components/ui/useToast";
import type { BoqWithDetails } from "@/types";

/**
 * Fetcher that converts a 404 ("no BOQ for this project yet") into `null`
 * so the hook can distinguish "not created" from a real load failure.
 */
async function boqFetcher(url: string): Promise<BoqWithDetails | null> {
  try {
    return await apiGet<BoqWithDetails>(url);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return null;
    throw err;
  }
}

/**
 * Reads the full BOQ (header + sections + items + summary) for a project.
 *
 * Returns `{ boq: null }` when the project has no BOQ yet. `error` is only
 * populated for real failures (auth, server, network).
 */
export function useBoq(projectId: string) {
  const key = API.boq(projectId);
  const { data, error, isLoading, isValidating, mutate } =
    useSWR<BoqWithDetails | null>(key, boqFetcher, {
      onError: (err: unknown) => {
        if (
          err instanceof ApiError &&
          (err.status === 401 || err.status === 404)
        )
          return;
        toast({
          title: "Error",
          description:
            err instanceof Error ? err.message : "Failed to load BOQ",
          variant: "error",
        });
      },
      shouldRetryOnError: (err: unknown) =>
        !(err instanceof ApiError && err.status === 404),
    });

  return {
    boq: data ?? null,
    notFound: data === null && !error && !isLoading,
    isLoading,
    isValidating,
    error,
    mutate,
    cacheKey: key,
  };
}
