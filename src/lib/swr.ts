import { apiGet, ApiError } from "@/lib/api/client";
import { toast } from "@/components/ui/useToast";
import type { SWRConfiguration } from "swr";

/** Default fetcher for SWR — uses our existing apiGet wrapper (handles errors, auth cookies). */
export const swrFetcher = <T>(url: string) => apiGet<T>(url);

/** Global SWR defaults applied via SWRConfig in the dashboard layout. */
export const swrConfig: SWRConfiguration = {
  fetcher: swrFetcher,
  revalidateOnFocus: true,
  revalidateOnReconnect: true,
  dedupingInterval: 5000,
  errorRetryCount: 3,
  onError: (error: unknown) => {
    if (error instanceof ApiError && error.status === 401) return;
    toast({
      title: "Error",
      description:
        error instanceof Error ? error.message : "Failed to load data",
      variant: "error",
    });
  },
};
