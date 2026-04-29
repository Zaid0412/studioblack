"use client";

import useSWR from "swr";
import { useCallback, useState } from "react";
import { vendors as vendorsApi } from "@/lib/api";
import type { ListVendorsResponse, VendorListRow } from "@/lib/api/vendors";
import { toast } from "@/components/ui/useToast";
import type {
  VendorWithRelations,
  BankDetails,
  VendorStatus,
  VendorKycStatus,
  VendorKycDocument,
} from "@/types";
import type { VendorSortField, SortOrder } from "@/lib/validations";

const PAGE_SIZE = 25;

export interface VendorFilterState {
  search: string;
  status?: VendorStatus;
  kycStatus?: VendorKycStatus;
  tradeCategoryId?: string;
  sortBy?: VendorSortField;
  sortOrder?: SortOrder;
  page: number;
}

/**
 * List + CRUD hook. Bank details and rating are managed via dedicated hooks
 * (`useVendorBankDetails`, `updateRating` here) to keep cache invalidation tight.
 */
export function useVendors(filters: VendorFilterState) {
  const params = {
    search: filters.search || undefined,
    status: filters.status,
    kycStatus: filters.kycStatus,
    tradeCategoryId: filters.tradeCategoryId,
    sortBy: filters.sortBy,
    sortOrder: filters.sortOrder,
    page: filters.page,
    limit: PAGE_SIZE,
  } as const;

  const key = vendorsApi.listKey(params);
  const { data, isLoading, isValidating, mutate } = useSWR<ListVendorsResponse>(
    key,
    { keepPreviousData: true }
  );

  const rows: VendorListRow[] = data?.rows ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const [submitting, setSubmitting] = useState(false);

  const create = useCallback(
    async (input: Parameters<typeof vendorsApi.create>[0]) => {
      setSubmitting(true);
      try {
        const created = await vendorsApi.create(input);
        toast({ title: "Vendor created" });
        mutate();
        return created;
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Failed to create";
        toast({ title: msg, variant: "error" });
        throw err;
      } finally {
        setSubmitting(false);
      }
    },
    [mutate]
  );

  const update = useCallback(
    async (id: string, input: Parameters<typeof vendorsApi.update>[1]) => {
      setSubmitting(true);
      try {
        const updated = await vendorsApi.update(id, input);
        toast({ title: "Vendor updated" });
        mutate();
        return updated;
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Failed to update";
        toast({ title: msg, variant: "error" });
        throw err;
      } finally {
        setSubmitting(false);
      }
    },
    [mutate]
  );

  const remove = useCallback(
    async (id: string) => {
      try {
        await vendorsApi.remove(id);
        toast({ title: "Vendor marked inactive" });
        mutate();
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Failed to delete";
        toast({ title: msg, variant: "error" });
      }
    },
    [mutate]
  );

  const removeHard = useCallback(
    async (id: string) => {
      try {
        await vendorsApi.removeHard(id);
        toast({ title: "Vendor permanently deleted" });
        mutate();
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Failed to delete";
        toast({ title: msg, variant: "error" });
      }
    },
    [mutate]
  );

  const updateRating = useCallback(
    async (id: string, rating: number) => {
      try {
        await vendorsApi.updateRating(id, rating);
        toast({ title: "Rating updated" });
        mutate();
      } catch (err) {
        const msg =
          err instanceof Error ? err.message : "Failed to update rating";
        toast({ title: msg, variant: "error" });
      }
    },
    [mutate]
  );

  return {
    rows,
    total,
    totalPages,
    pageSize: PAGE_SIZE,
    isLoading,
    isValidating,
    mutate,
    submitting,
    create,
    update,
    remove,
    removeHard,
    updateRating,
  };
}

/** Detail fetch for a single vendor with relations. */
export function useVendor(id: string | null) {
  const { data, isLoading, mutate } = useSWR<VendorWithRelations>(
    id ? `/api/vendors/${id}` : null
  );
  return { vendor: data ?? null, isLoading, mutate };
}

/**
 * Bank details — lazy-loaded only when the bank tab opens (PM only).
 * Pass `enabled: false` to suppress the fetch until the user opts in.
 */
export function useVendorBankDetails(
  vendorId: string | null,
  enabled: boolean = true
) {
  const key =
    vendorId && enabled ? `/api/vendors/${vendorId}/bank-details` : null;
  const { data, isLoading, error, mutate } = useSWR<{
    data: BankDetails | null;
  }>(key);

  const save = useCallback(
    async (bankDetails: BankDetails | null) => {
      if (!vendorId) return;
      try {
        await vendorsApi.updateBankDetails(vendorId, bankDetails);
        toast({
          title: bankDetails ? "Bank details saved" : "Bank details cleared",
        });
        mutate();
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Failed to save";
        toast({ title: msg, variant: "error" });
        throw err;
      }
    },
    [vendorId, mutate]
  );

  return {
    bankDetails: data?.data ?? null,
    isLoading,
    error,
    save,
  };
}

/**
 * KYC documents — lazy-loaded once the KYC tab opens. Includes upload, remove,
 * and PM-only status flip. Mutates both the list cache and the parent vendor
 * fetch so the drawer header and "expiring soon" count stay in sync.
 */
export function useVendorKyc(
  vendorId: string | null,
  enabled: boolean = true,
  onVendorMutate?: () => void
) {
  const key =
    vendorId && enabled ? `/api/vendors/${vendorId}/kyc-documents` : null;
  const { data, isLoading, error, mutate } = useSWR<{
    documents: VendorKycDocument[];
  }>(key);

  const addDocument = useCallback(
    async (input: Parameters<typeof vendorsApi.addKycDocument>[1]) => {
      if (!vendorId) return;
      try {
        const res = await vendorsApi.addKycDocument(vendorId, input);
        toast({ title: "Document added" });
        mutate();
        onVendorMutate?.();
        return res;
      } catch (err) {
        const msg =
          err instanceof Error ? err.message : "Failed to add document";
        toast({ title: msg, variant: "error" });
        throw err;
      }
    },
    [vendorId, mutate, onVendorMutate]
  );

  const removeDocument = useCallback(
    async (docId: string) => {
      if (!vendorId) return;
      try {
        await vendorsApi.removeKycDocument(vendorId, docId);
        toast({ title: "Document removed" });
        mutate();
        onVendorMutate?.();
      } catch (err) {
        const msg =
          err instanceof Error ? err.message : "Failed to remove document";
        toast({ title: msg, variant: "error" });
      }
    },
    [vendorId, mutate, onVendorMutate]
  );

  const setStatus = useCallback(
    async (kycStatus: VendorKycStatus, kycNotes: string | null) => {
      if (!vendorId) return;
      try {
        await vendorsApi.setKycStatus(vendorId, { kycStatus, kycNotes });
        toast({ title: "KYC status updated" });
        onVendorMutate?.();
      } catch (err) {
        const msg =
          err instanceof Error ? err.message : "Failed to update status";
        toast({ title: msg, variant: "error" });
        throw err;
      }
    },
    [vendorId, onVendorMutate]
  );

  return {
    documents: data?.documents ?? [],
    isLoading,
    error,
    addDocument,
    removeDocument,
    setStatus,
  };
}
