import { apiGet } from "@/lib/api/client";
import type { SWRConfiguration } from "swr";

/** Default fetcher for SWR — uses our existing apiGet wrapper (handles errors, auth cookies). */
export const swrFetcher = <T>(url: string) => apiGet<T>(url);

/** Global SWR defaults applied via SWRConfig in the dashboard layout. */
export const swrConfig: SWRConfiguration = {
  fetcher: swrFetcher,
  revalidateOnFocus: true,
  dedupingInterval: 5000,
  errorRetryCount: 3,
};
