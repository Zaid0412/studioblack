"use client";

import { useCallback } from "react";
import useSWR, { mutate as globalMutate } from "swr";
import { rfqs as rfqApi, ApiError } from "@/lib/api";
import { API } from "@/lib/api/routes";
import { toast } from "@/components/ui/useToast";
import type { Rfq, RfqStatus } from "@/types";
import type { ListRfqsResponse } from "@/lib/api/rfqs";
import type { z } from "zod";
import type {
  cancelRfqSchema,
  createRfqSchema,
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
 * every click.
 */
export function useRfqList(projectId: string, params: UseRfqListParams) {
  const key = rfqApi.listKey(projectId, params);
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

  const invalidateList = useCallback(async () => {
    await globalMutate(
      (k) => typeof k === "string" && k.startsWith(listPrefix),
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

  return { create, update, issue, cancel, invalidateList };
}
