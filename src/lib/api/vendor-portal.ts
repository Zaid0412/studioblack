import { apiGet, apiPost, apiPatch, apiPut, apiDelete } from "./client";
import { API } from "./routes";
import type {
  VendorWithRelations,
  VendorKycDocument,
  VendorKycStatus,
  BankDetails,
  VendorDashboard,
} from "@/types";
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

export interface VendorMeResponse {
  vendor: VendorWithRelations;
  suspended: boolean;
}

/** GET /api/vendor-portal/dashboard — aggregated KPIs, quote outcomes, awaiting RFQs. */
export function getDashboard() {
  return apiGet<VendorDashboard>(API.vendorPortalDashboard());
}

/** GET /api/vendor-portal/me — vendor's own record + suspended flag. */
export function getMe() {
  return apiGet<VendorMeResponse>(API.vendorPortalMe());
}

/** SWR key for /me. */
export function meKey(): string {
  return API.vendorPortalMe();
}

/** PATCH /api/vendor-portal/me — update self-editable fields. */
export function updateMe(data: UpdateMeInput) {
  return apiPatch<{ vendor: VendorWithRelations }>(API.vendorPortalMe(), data);
}

/** GET /api/vendor-portal/me/bank-details — vendor's own decrypted bank details. */
export function getBankDetails() {
  return apiGet<{ data: BankDetails | null }>(API.vendorPortalBankDetails());
}

/** PUT /api/vendor-portal/me/bank-details — set or clear (`null`). */
export function updateBankDetails(data: BankDetails | null) {
  return apiPut<{ success: true }>(API.vendorPortalBankDetails(), { data });
}

/** GET /api/vendor-portal/me/kyc-documents — list vendor's own KYC documents. */
export function listKycDocuments() {
  return apiGet<{ documents: VendorKycDocument[] }>(
    API.vendorPortalKycDocuments()
  );
}

/** POST /api/vendor-portal/me/kyc-documents — upload a new KYC document. */
export function addKycDocument(data: AddKycDocInput) {
  return apiPost<{
    document: VendorKycDocument;
    vendor_kyc_status: VendorKycStatus;
  }>(API.vendorPortalKycDocuments(), data);
}

/** DELETE /api/vendor-portal/me/kyc-documents/:docId — remove a doc. */
export function removeKycDocument(docId: string) {
  return apiDelete<{ success: true }>(API.vendorPortalKycDocument(docId));
}

/** POST /api/vendor-portal/me/contacts — append a contact row. */
export function addContact(data: ContactCreateInput) {
  return apiPost<{ id: string }>(API.vendorPortalContacts(), data);
}

/** PATCH /api/vendor-portal/me/contacts/:contactId — edit one contact. */
export function updateContact(contactId: string, data: ContactPatchInput) {
  return apiPatch<{ success: true }>(API.vendorPortalContact(contactId), data);
}

/** DELETE /api/vendor-portal/me/contacts/:contactId — remove a contact. */
export function removeContact(contactId: string) {
  return apiDelete<{ success: true }>(API.vendorPortalContact(contactId));
}
