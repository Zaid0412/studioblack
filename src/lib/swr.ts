import { useCallback } from "react";
import type { KeyedMutator } from "swr";
import type { SWRConfiguration } from "swr";
import { apiGet, ApiError } from "@/lib/api/client";
import { toast } from "@/components/ui/useToast";

/** Default fetcher for SWR — uses our existing apiGet wrapper (handles errors, auth cookies). */
export const swrFetcher = <T>(url: string) => apiGet<T>(url);

/**
 * Creates a React.Dispatch<SetStateAction<TField>> that writes to a single
 * field inside an SWR cache entry via optimistic mutation.
 *
 * Usage:
 *   const setTasks = useSwrFieldAdapter<TaskListResponse, Task[]>(mutate, "tasks");
 *   // now pass `setTasks` to hooks that expect React.Dispatch<SetStateAction<Task[]>>
 */
export function useSwrFieldAdapter<TData, TField>(
  mutate: KeyedMutator<TData>,
  fieldKey: keyof TData
): React.Dispatch<React.SetStateAction<TField>> {
  return useCallback(
    (action: React.SetStateAction<TField>) => {
      mutate(
        (prev) => {
          if (!prev) return prev;
          const newValue =
            typeof action === "function"
              ? (action as (prev: TField) => TField)(
                  prev[fieldKey] as unknown as TField
                )
              : action;
          return { ...prev, [fieldKey]: newValue };
        },
        { revalidate: false }
      );
    },
    [mutate, fieldKey]
  );
}

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
