"use client";

import { useCallback } from "react";
import useSWR, { mutate as globalMutate } from "swr";
import { rfqs as rfqApi, ApiError } from "@/lib/api";
import { API } from "@/lib/api/routes";
import { toast } from "@/components/ui/useToast";
import type { Rfq, RfqStatus, RfqWithItems, VendorLite } from "@/types";
import type { ListRfqsResponse } from "@/lib/api/rfqs";
import type { z } from "zod";
import type {
  addRfqItemsSchema,
  cancelRfqSchema,
  createRfqSchema,
  inviteRfqVendorsSchema,
  issueRfqSchema,
  updateRfqSchema,
} from "@/lib/validations";

export interface UseRfqListParams {
  status?: RfqStatus;
  search?: string;
  page: number;
  limit: number;
}

/**
 * Studio RFQ list, SWR-backed. `keepPreviousData` keeps the table populated
 * while a new page/filter loads so the UI doesn't blank to skeletons on
 * every click. Pass `enabled: false` to skip the fetch entirely — e.g. for
 * viewers (clients/vendors) the API would 403 anyway.
 */
export function useRfqList(
  projectId: string,
  params: UseRfqListParams,
  options: { enabled?: boolean } = {}
) {
  const { enabled = true } = options;
  const key = enabled ? rfqApi.listKey(projectId, params) : null;
  const { data, error, isLoading, isValidating, mutate } =
    useSWR<ListRfqsResponse>(key, {
      keepPreviousData: true,
      onError: (err: unknown) => {
        if (
          err instanceof ApiError &&
          (err.status === 401 || err.status === 403)
        )
          return;
        toast({
          title: "Error",
          description:
            err instanceof Error ? err.message : "Failed to load RFQs",
          variant: "error",
        });
      },
    });

  return {
    rows: data?.rows ?? [],
    total: data?.total ?? 0,
    readyNotInRfq: data?.readyNotInRfq ?? 0,
    isLoading,
    isValidating,
    error,
    mutate,
    cacheKey: key,
  };
}

/**
 * Mutation helpers. Each one toasts on error and invalidates the project's
 * RFQ list cache (the broad `/api/projects/[id]/rfqs` prefix) so any
 * filtered/paginated keys re-fetch.
 */
export function useRfqMutations(projectId: string) {
  const listPrefix = API.rfqs(projectId);

  const handleError = (err: unknown, fallback: string) => {
    const description =
      err instanceof ApiError
        ? err.message
        : err instanceof Error
          ? err.message
          : fallback;
    toast({ title: fallback, description, variant: "error" });
  };

  /**
   * Match the bare list key and any filtered variant (`?status=…`). Does
   * NOT match the detail key (`/uuid`) — detail pages own their own
   * `mutate()` so we don't double-fetch.
   */
  const invalidateList = useCallback(async () => {
    await globalMutate(
      (k) =>
        typeof k === "string" &&
        (k === listPrefix || k.startsWith(`${listPrefix}?`)),
      undefined,
      { revalidate: true }
    );
  }, [listPrefix]);

  const create = useCallback(
    async (data: z.infer<typeof createRfqSchema>): Promise<Rfq | null> => {
      try {
        const rfq = await rfqApi.create(projectId, data);
        await invalidateList();
        return rfq;
      } catch (err) {
        handleError(err, "Could not create RFQ");
        return null;
      }
    },
    [projectId, invalidateList]
  );

  const update = useCallback(
    async (rfqId: string, data: z.infer<typeof updateRfqSchema>) => {
      try {
        const rfq = await rfqApi.update(projectId, rfqId, data);
        await invalidateList();
        return rfq;
      } catch (err) {
        handleError(err, "Could not update RFQ");
        return null;
      }
    },
    [projectId, invalidateList]
  );

  const issue = useCallback(
    async (rfqId: string, data: z.infer<typeof issueRfqSchema>) => {
      try {
        const res = await rfqApi.issue(projectId, rfqId, data);
        await invalidateList();
        toast({
          title: "RFQ issued",
          description: `${res.invitedContactCount} email${
            res.invitedContactCount === 1 ? "" : "s"
          } sent.`,
          variant: "success",
        });
        return res;
      } catch (err) {
        handleError(err, "Could not issue RFQ");
        return null;
      }
    },
    [projectId, invalidateList]
  );

  const invite = useCallback(
    async (rfqId: string, data: z.infer<typeof inviteRfqVendorsSchema>) => {
      try {
        const res = await rfqApi.invite(projectId, rfqId, data);
        await invalidateList();
        if (res.addedVendorCount === 0) {
          toast({
            title: "All picks were already on this RFQ",
            description: "No new emails sent.",
            variant: "warning",
          });
        } else {
          toast({
            title: "Vendors invited",
            description: `${res.addedVendorCount} added · ${res.invitedContactCount} email${
              res.invitedContactCount === 1 ? "" : "s"
            } sent.`,
            variant: "success",
          });
        }
        return res;
      } catch (err) {
        handleError(err, "Could not invite vendors");
        return null;
      }
    },
    [projectId, invalidateList]
  );

  const cancel = useCallback(
    async (rfqId: string, data: z.infer<typeof cancelRfqSchema>) => {
      try {
        const rfq = await rfqApi.cancel(projectId, rfqId, data);
        await invalidateList();
        toast({ title: "RFQ cancelled", variant: "success" });
        return rfq;
      } catch (err) {
        handleError(err, "Could not cancel RFQ");
        return null;
      }
    },
    [projectId, invalidateList]
  );

  const revise = useCallback(
    async (rfqId: string, data: { reason?: string | null }) => {
      try {
        const rfq = await rfqApi.revise(projectId, rfqId, data);
        await invalidateList();
        toast({ title: "Revision created", variant: "success" });
        return rfq;
      } catch (err) {
        handleError(err, "Could not create revision");
        return null;
      }
    },
    [projectId, invalidateList]
  );

  const syncBoq = useCallback(
    async (rfqId: string) => {
      try {
        const res = await rfqApi.syncBoq(projectId, rfqId);
        await invalidateList();
        toast({
          title: `Synced ${res.synced} item${res.synced === 1 ? "" : "s"} from the BOQ`,
          variant: "success",
        });
        return res;
      } catch (err) {
        handleError(err, "Could not sync from the BOQ");
        return null;
      }
    },
    [projectId, invalidateList]
  );

  const addItems = useCallback(
    async (rfqId: string, data: z.infer<typeof addRfqItemsSchema>) => {
      try {
        const res = await rfqApi.addItems(projectId, rfqId, data);
        await invalidateList();
        toast({
          title: "Items added",
          description: `${res.count} item${res.count === 1 ? "" : "s"} added.`,
          variant: "success",
        });
        return res;
      } catch (err) {
        handleError(err, "Could not add items");
        return null;
      }
    },
    [projectId, invalidateList]
  );

  const removeItem = useCallback(
    async (rfqId: string, itemId: string) => {
      try {
        await rfqApi.removeItem(projectId, rfqId, itemId);
        await invalidateList();
        return true;
      } catch (err) {
        handleError(err, "Could not remove item");
        return false;
      }
    },
    [projectId, invalidateList]
  );

  return {
    create,
    update,
    issue,
    invite,
    addItems,
    removeItem,
    cancel,
    revise,
    syncBoq,
    invalidateList,
  };
}

// ── Detail + vendor-portal hooks ────────────────────────────────────────────

/**
 * Studio RFQ detail (header + items + invited vendors). 404 is treated as a
 * real "not found" — the caller renders an empty state, not an error toast.
 */
export function useRfqDetail(projectId: string, rfqId: string) {
  const key = API.rfq(projectId, rfqId);
  const { data, error, isLoading, mutate } = useSWR<RfqWithItems | null>(
    key,
    async () => {
      try {
        return await rfqApi.get(projectId, rfqId);
      } catch (err) {
        if (err instanceof ApiError && err.status === 404) return null;
        throw err;
      }
    },
    {
      onError: (err: unknown) => {
        if (
          err instanceof ApiError &&
          (err.status === 401 || err.status === 403)
        )
          return;
        toast({
          title: "Error",
          description:
            err instanceof Error ? err.message : "Failed to load RFQ",
          variant: "error",
        });
      },
    }
  );
  return {
    rfq: data ?? null,
    notFound: data === null && !error && !isLoading,
    isLoading,
    error,
    mutate,
    cacheKey: key,
  };
}

/**
 * Vendors for an RFQ's issue/invite picker. Lazy — only fetches once `enabled`
 * flips true (typically when the dialog opens) to avoid a wasted query for
 * every detail view. `all` swaps the trade-matched suggestion list for every
 * active vendor in the org; each variant is cached under its own key, so
 * toggling back and forth doesn't refetch.
 */
export function useRfqSuggestedVendors(
  projectId: string,
  rfqId: string,
  enabled: boolean,
  all = false
) {
  const key = enabled ? API.rfqSuggestedVendors(projectId, rfqId, all) : null;
  const { data, error, isLoading } = useSWR<{ vendors: VendorLite[] }>(key);
  return {
    vendors: data?.vendors ?? [],
    isLoading,
    error,
  };
}

/** Vendor-portal RFQ list. Caller owns the filter state. */
export function useVendorRfqs(params: UseRfqListParams) {
  const search = new URLSearchParams();
  if (params.search) search.set("search", params.search);
  if (params.status) search.set("status", params.status);
  if (params.page !== undefined) search.set("page", String(params.page));
  if (params.limit !== undefined) search.set("limit", String(params.limit));
  const qs = search.toString();
  const key = `${API.vendorPortalRfqs()}${qs ? `?${qs}` : ""}`;

  const { data, error, isLoading, isValidating, mutate } =
    useSWR<ListRfqsResponse>(key, { keepPreviousData: true });
  return {
    rows: data?.rows ?? [],
    total: data?.total ?? 0,
    isLoading,
    isValidating,
    error,
    mutate,
    cacheKey: key,
  };
}

/** Vendor-portal RFQ detail (no invited-vendors list — competitive info). */
export function useVendorRfqDetail(rfqId: string) {
  const key = API.vendorPortalRfq(rfqId);
  const { data, error, isLoading, mutate } = useSWR<Omit<
    RfqWithItems,
    "vendors"
  > | null>(key, async () => {
    try {
      return await rfqApi.vendorGet(rfqId);
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) return null;
      throw err;
    }
  });
  return {
    rfq: data ?? null,
    notFound: data === null && !error && !isLoading,
    isLoading,
    error,
    mutate,
  };
}
