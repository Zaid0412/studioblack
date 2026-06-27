import { apiGet, apiPost, apiPatch, apiPut, apiDelete } from "./client";
import { API } from "./routes";
import type {
  Vendor,
  VendorWithRelations,
  VendorLite,
  VendorKycDocument,
  VendorKycStatus,
  BankDetails,
} from "@/types";
import type { z } from "zod";
import type {
  createVendorSchema,
  updateVendorSchema,
  listVendorsQuerySchema,
  vendorKycDocumentSchema,
  vendorKycStatusSchema,
} from "@/lib/validations";

type CreateInput = z.infer<typeof createVendorSchema>;
type UpdateInput = z.infer<typeof updateVendorSchema>;
type ListParams = Partial<z.input<typeof listVendorsQuerySchema>>;
type AddKycDocInput = z.infer<typeof vendorKycDocumentSchema>;
type SetKycStatusInput = z.infer<typeof vendorKycStatusSchema>;

/**
 * A vendor row in the list view. Slimmer than the full detail: the list SELECT
 * deliberately omits `gstin`, `website`, `brands_supported`
 * (potentially TOAST-bloated text arrays that the list UI doesn't render).
 * Callers that need those must fetch the single vendor via `get(id)`.
 */
export type VendorListRow = Omit<
  Vendor,
  "gstin" | "website" | "brands_supported"
> & {
  contact_count: number;
  primary_contact_email: string | null;
  trade_count: number;
};

export interface ListVendorsResponse {
  rows: VendorListRow[];
  total: number;
  page: number;
  limit: number;
}

function buildQuery(params: ListParams): string {
  const search = new URLSearchParams();
  if (params.search) search.set("search", params.search);
  if (params.status) search.set("status", params.status);
  if (params.kycStatus) search.set("kycStatus", params.kycStatus);
  if (params.tradeCategoryId)
    search.set("tradeCategoryId", params.tradeCategoryId);
  if (params.preferred) search.set("preferred", "true");
  if (params.sortBy) search.set("sortBy", params.sortBy);
  if (params.sortOrder) search.set("sortOrder", params.sortOrder);
  if (params.page !== undefined) search.set("page", String(params.page));
  if (params.limit !== undefined) search.set("limit", String(params.limit));
  const qs = search.toString();
  return qs ? `?${qs}` : "";
}

/** List vendors with filters + pagination. */
export function list(params: ListParams = {}) {
  return apiGet<ListVendorsResponse>(`${API.vendors()}${buildQuery(params)}`);
}

/** Build the SWR key for a filtered list. */
export function listKey(params: ListParams = {}): string {
  return `${API.vendors()}${buildQuery(params)}`;
}

/** Fetch a single vendor with contacts + trades. */
export function get(id: string) {
  return apiGet<VendorWithRelations>(API.vendor(id));
}

/** Create a vendor with optional nested contacts and trades. PM only. */
export function create(data: CreateInput) {
  return apiPost<VendorWithRelations>(API.vendors(), data);
}

/** Update non-financial fields. */
export function update(id: string, data: UpdateInput) {
  return apiPatch<VendorWithRelations>(API.vendor(id), data);
}

/** Soft delete (status → inactive). */
export function remove(id: string) {
  return apiDelete<{ success: true; mode: "soft" }>(API.vendor(id));
}

/** Permanently delete the vendor row. PM only. CASCADE removes contacts/trades. */
export function removeHard(id: string) {
  return apiDelete<{ success: true; mode: "hard" }>(
    `${API.vendor(id)}?hard=true`
  );
}

/** Fetch decrypted bank details. PM only. Audit-logged on the server. */
export function getBankDetails(id: string) {
  return apiGet<{ data: BankDetails | null }>(API.vendorBankDetails(id));
}

/** Set or clear bank details. Pass `null` to clear. PM only. Audit-logged. */
export function updateBankDetails(id: string, data: BankDetails | null) {
  return apiPut<{ success: true }>(API.vendorBankDetails(id), { data });
}

/** Set the manual vendor rating. PM + Architect. */
export function updateRating(id: string, rating: number) {
  return apiPatch<Vendor>(API.vendorRating(id), { rating });
}

/** Vendors that handle the given element category. For F9 RFQ vendor picker. */
export function listByTrade(categoryId: string) {
  return apiGet<{ rows: VendorLite[] }>(API.vendorsByTrade(categoryId));
}

/**
 * Invite a vendor contact to the vendor portal. Server returns:
 * - `{ status: "linked" }` — user already in org, vendor_contact.user_id was backfilled
 * - `{ status: "invited" }` — invitation email sent (or resent for existing pending invites)
 */
export function inviteContact(vendorId: string, contactId: string) {
  return apiPost<{ status: "linked" | "invited" }>(
    API.vendorContactInvite(vendorId, contactId),
    {}
  );
}

// ─── KYC (F7.1) ─────────────────────────────────────────────────────────────

/** List KYC documents for a vendor. */
export function listKycDocuments(id: string) {
  return apiGet<{ documents: VendorKycDocument[] }>(API.vendorKycDocuments(id));
}

/** Add a KYC document. Server may auto-flip vendor status to `pending`. */
export function addKycDocument(id: string, data: AddKycDocInput) {
  return apiPost<{
    document: VendorKycDocument;
    vendor_kyc_status: VendorKycStatus;
  }>(API.vendorKycDocuments(id), data);
}

/** Remove a KYC document (file in storage is preserved). */
export function removeKycDocument(id: string, docId: string) {
  return apiDelete<{ success: true }>(API.vendorKycDocument(id, docId));
}

/** Flip the vendor's KYC verification state. PM only on the server. */
export function setKycStatus(id: string, data: SetKycStatusInput) {
  return apiPatch<VendorWithRelations>(API.vendorKycStatus(id), data);
}
