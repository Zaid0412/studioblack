"use client";

import { useCallback } from "react";
import useSWR, { mutate as globalMutate } from "swr";
import { quotes as quoteApi, rfqs as rfqApi, ApiError } from "@/lib/api";
import { API } from "@/lib/api/routes";
import { toast } from "@/components/ui/useToast";
import type { QuoteComparison, VendorQuoteWithItems } from "@/types";
import type { z } from "zod";
import type {
  awardRfqSingleSchema,
  awardRfqSplitSchema,
  submitQuoteSchema,
} from "@/lib/validations";

type SubmitInput = z.input<typeof submitQuoteSchema>;
type AwardSingleInput = z.infer<typeof awardRfqSingleSchema>;
type AwardSplitInput = z.infer<typeof awardRfqSplitSchema>;

/** Architect: list every quote for an RFQ. */
export function useQuotesForRfq(projectId: string, rfqId: string) {
  const key = API.rfqQuotes(projectId, rfqId);
  const { data, error, isLoading, mutate } = useSWR<{
    quotes: VendorQuoteWithItems[];
  }>(key);
  return {
    quotes: data?.quotes ?? [],
    isLoading,
    error,
    mutate,
    cacheKey: key,
  };
}

/** Architect: side-by-side comparison shape. */
export function useQuoteComparison(projectId: string, rfqId: string) {
  const key = API.rfqComparison(projectId, rfqId);
  const { data, error, isLoading, mutate } = useSWR<QuoteComparison>(key);
  return {
    comparison: data ?? null,
    isLoading,
    error,
    mutate,
    cacheKey: key,
  };
}

/**
 * Architect: award action. Returns helpers so the calling component can
 * trigger the mutation and SWR-invalidate the surrounding RFQ context in
 * one shot. Both single + split share invalidation targets.
 */
export function useAwardRfq(projectId: string, rfqId: string) {
  const invalidate = useCallback(() => {
    void globalMutate(API.rfqQuotes(projectId, rfqId));
    void globalMutate(API.rfqComparison(projectId, rfqId));
    void globalMutate(API.rfq(projectId, rfqId));
    void globalMutate(rfqApi.listKey(projectId));
  }, [projectId, rfqId]);

  const awardSingle = useCallback(
    async (data: AwardSingleInput) => {
      try {
        const res = await quoteApi.awardSingle(projectId, rfqId, data);
        invalidate();
        toast({
          title: "Award sent",
          description: "The winning vendor has been notified.",
          variant: "success",
        });
        return res;
      } catch (err) {
        toast({
          title: "Award failed",
          description:
            err instanceof Error ? err.message : "Could not award RFQ",
          variant: "error",
        });
        throw err;
      }
    },
    [projectId, rfqId, invalidate]
  );

  const awardSplit = useCallback(
    async (data: AwardSplitInput) => {
      try {
        const res = await quoteApi.awardSplit(projectId, rfqId, data);
        invalidate();
        toast({
          title: "Split award sent",
          description: "Winning vendors have been notified.",
          variant: "success",
        });
        return res;
      } catch (err) {
        toast({
          title: "Award failed",
          description:
            err instanceof Error ? err.message : "Could not award RFQ",
          variant: "error",
        });
        throw err;
      }
    },
    [projectId, rfqId, invalidate]
  );

  return { awardSingle, awardSplit };
}

/** Vendor portal: caller's own quote (null when not submitted yet). */
export function useVendorQuote(rfqId: string) {
  const key = API.vendorPortalRfqQuote(rfqId);
  const { data, error, isLoading, mutate } = useSWR<{
    quote: VendorQuoteWithItems | null;
  }>(key, async () => {
    try {
      return await quoteApi.vendorGet(rfqId);
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        return { quote: null };
      }
      throw err;
    }
  });
  return {
    quote: data?.quote ?? null,
    isLoading,
    error,
    mutate,
    cacheKey: key,
  };
}

/** Vendor portal: submit / revise the caller's quote. */
export function useVendorSubmitQuote(rfqId: string) {
  return useCallback(
    async (data: SubmitInput) => {
      try {
        const res = await quoteApi.vendorSubmit(rfqId, data);
        void globalMutate(API.vendorPortalRfqQuote(rfqId));
        void globalMutate(API.vendorPortalRfq(rfqId));
        toast({
          title: res.isNew ? "Quote submitted" : "Revision saved",
          description: res.isNew
            ? "The studio has been notified."
            : "Your revised quote has been sent.",
          variant: "success",
        });
        return res;
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Could not submit quote";
        toast({
          title: "Submission failed",
          description: message,
          variant: "error",
        });
        throw err;
      }
    },
    [rfqId]
  );
}
