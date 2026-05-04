"use client";

import useSWR from "swr";
import { useCallback } from "react";
import { vendorPortal as portalApi } from "@/lib/api";
import { toast } from "@/components/ui/useToast";
import type { VendorMeResponse } from "@/lib/api/vendor-portal";
import type { BankDetails, VendorKycDocument } from "@/types";
import type { z } from "zod";
import type {
  vendorPortalUpdateSchema,
  vendorPortalContactCreateSchema,
  vendorPortalContactPatchSchema,
  vendorKycDocumentSchema,
} from "@/lib/validations";

type UpdateMeInput = z.infer<typeof vendorPortalUpdateSchema>;
type ContactCreateInput = z.infer<typeof vendorPortalContactCreateSchema>;
type ContactPatchInput = z.infer<typeof vendorPortalContactPatchSchema>;
type AddKycDocInput = z.infer<typeof vendorKycDocumentSchema>;

/**
 * Vendor's own record. Drives the profile page and is mutated whenever
 * downstream hooks change something the vendor record reflects (suspended
 * flag, KYC status, contact list).
 */
export function useVendorMe() {
  const { data, isLoading, error, mutate } = useSWR<VendorMeResponse>(
    portalApi.meKey()
  );

  const save = useCallback(
    async (input: UpdateMeInput) => {
      try {
        await portalApi.updateMe(input);
        toast({ title: "Profile saved" });
        await mutate();
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Failed to save";
        toast({ title: msg, variant: "error" });
        throw err;
      }
    },
    [mutate]
  );

  return {
    vendor: data?.vendor,
    suspended: data?.suspended ?? false,
    isLoading,
    error,
    mutate,
    save,
  };
}

/** Vendor's own bank details (encrypted server-side, decrypted on read). */
export function useVendorMeBankDetails(enabled: boolean = true) {
  const key = enabled ? "/api/vendor-portal/me/bank-details" : null;
  const { data, isLoading, error, mutate } = useSWR<{
    data: BankDetails | null;
  }>(key);

  const save = useCallback(
    async (bankDetails: BankDetails | null) => {
      try {
        await portalApi.updateBankDetails(bankDetails);
        toast({
          title: bankDetails ? "Bank details saved" : "Bank details cleared",
        });
        await mutate();
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Failed to save";
        toast({ title: msg, variant: "error" });
        throw err;
      }
    },
    [mutate]
  );

  return {
    bankDetails: data?.data ?? null,
    isLoading,
    error,
    save,
  };
}

/**
 * Vendor's own KYC documents. After upload/remove, also refreshes the parent
 * vendor record so the kyc_status badge stays in sync (uploads flip it to
 * `pending`).
 */
export function useVendorMeKyc(
  enabled: boolean = true,
  onVendorMutate?: () => void
) {
  const key = enabled ? "/api/vendor-portal/me/kyc-documents" : null;
  const { data, isLoading, error, mutate } = useSWR<{
    documents: VendorKycDocument[];
  }>(key);

  const addDocument = useCallback(
    async (input: AddKycDocInput) => {
      try {
        await portalApi.addKycDocument(input);
        toast({ title: "Document added" });
        await mutate();
        onVendorMutate?.();
      } catch (err) {
        const msg =
          err instanceof Error ? err.message : "Failed to add document";
        toast({ title: msg, variant: "error" });
        throw err;
      }
    },
    [mutate, onVendorMutate]
  );

  const removeDocument = useCallback(
    async (docId: string) => {
      try {
        await portalApi.removeKycDocument(docId);
        toast({ title: "Document removed" });
        await mutate();
        onVendorMutate?.();
      } catch (err) {
        const msg =
          err instanceof Error ? err.message : "Failed to remove document";
        toast({ title: msg, variant: "error" });
        throw err;
      }
    },
    [mutate, onVendorMutate]
  );

  return {
    documents: data?.documents ?? [],
    isLoading,
    error,
    addDocument,
    removeDocument,
  };
}

/**
 * Vendor's own contacts. Per-row CRUD (the vendor record's `contacts` array
 * is owned by `useVendorMe`; mutating any contact re-fetches `me`).
 */
export function useVendorMeContacts(onVendorMutate: () => void) {
  const addContact = useCallback(
    async (input: ContactCreateInput) => {
      try {
        const result = await portalApi.addContact(input);
        toast({ title: "Contact added" });
        onVendorMutate();
        return result;
      } catch (err) {
        const msg =
          err instanceof Error ? err.message : "Failed to add contact";
        toast({ title: msg, variant: "error" });
        throw err;
      }
    },
    [onVendorMutate]
  );

  const updateContact = useCallback(
    async (contactId: string, patch: ContactPatchInput) => {
      try {
        await portalApi.updateContact(contactId, patch);
        toast({ title: "Contact updated" });
        onVendorMutate();
      } catch (err) {
        const msg =
          err instanceof Error ? err.message : "Failed to update contact";
        toast({ title: msg, variant: "error" });
        throw err;
      }
    },
    [onVendorMutate]
  );

  const removeContact = useCallback(
    async (contactId: string) => {
      try {
        await portalApi.removeContact(contactId);
        toast({ title: "Contact removed" });
        onVendorMutate();
      } catch (err) {
        const msg =
          err instanceof Error ? err.message : "Failed to remove contact";
        toast({ title: msg, variant: "error" });
        throw err;
      }
    },
    [onVendorMutate]
  );

  return { addContact, updateContact, removeContact };
}
