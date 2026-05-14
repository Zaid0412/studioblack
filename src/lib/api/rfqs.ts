import { apiGet, apiPatch, apiPost } from "./client";
import { API } from "./routes";
import type { Rfq, RfqListRow, RfqWithItems, VendorLite } from "@/types";
import type { z } from "zod";
import type {
  cancelRfqSchema,
  createRfqSchema,
  issueRfqSchema,
  listRfqsQuerySchema,
  updateRfqSchema,
} from "@/lib/validations";

type ListParams = Partial<z.input<typeof listRfqsQuerySchema>>;
type CreateInput = z.infer<typeof createRfqSchema>;
type UpdateInput = z.infer<typeof updateRfqSchema>;
type IssueInput = z.infer<typeof issueRfqSchema>;
type CancelInput = z.infer<typeof cancelRfqSchema>;

export interface ListRfqsResponse {
  rows: RfqListRow[];
  total: number;
  page: number;
  limit: number;
}

function buildQuery(params: ListParams): string {
  const search = new URLSearchParams();
  if (params.search) search.set("search", params.search);
  if (params.status) search.set("status", params.status);
  if (params.page !== undefined) search.set("page", String(params.page));
  if (params.limit !== undefined) search.set("limit", String(params.limit));
  const qs = search.toString();
  return qs ? `?${qs}` : "";
}

/** Studio: paginated RFQ list for a project. */
export function list(projectId: string, params: ListParams = {}) {
  return apiGet<ListRfqsResponse>(
    `${API.rfqs(projectId)}${buildQuery(params)}`
  );
}

/** SWR cache key for the studio list. */
export function listKey(projectId: string, params: ListParams = {}): string {
  return `${API.rfqs(projectId)}${buildQuery(params)}`;
}

/** Studio: full RFQ detail (header + items + invited vendors). */
export function get(projectId: string, rfqId: string) {
  return apiGet<RfqWithItems>(API.rfq(projectId, rfqId));
}

/** Studio: vendors whose trades match this RFQ's items. */
export function suggestedVendors(projectId: string, rfqId: string) {
  return apiGet<{ vendors: VendorLite[] }>(
    API.rfqSuggestedVendors(projectId, rfqId)
  );
}

/** Vendor portal: RFQs this vendor has been invited to. */
export function vendorList(params: ListParams = {}) {
  return apiGet<ListRfqsResponse>(
    `${API.vendorPortalRfqs()}${buildQuery(params)}`
  );
}

/** Vendor portal: detail scoped to the caller's vendor. */
export function vendorGet(rfqId: string) {
  return apiGet<Omit<RfqWithItems, "vendors">>(API.vendorPortalRfq(rfqId));
}

/** Studio: create an RFQ draft + items. */
export function create(projectId: string, data: CreateInput) {
  return apiPost<Rfq>(API.rfqs(projectId), data);
}

/** Studio: patch a draft RFQ header. Returns 409 once issued. */
export function update(projectId: string, rfqId: string, patch: UpdateInput) {
  return apiPatch<Rfq>(API.rfq(projectId, rfqId), patch);
}

/** Studio: issue a draft RFQ to selected vendors. Fires emails server-side. */
export function issue(projectId: string, rfqId: string, data: IssueInput) {
  return apiPost<{ rfq: Rfq; invitedContactCount: number }>(
    API.rfqIssue(projectId, rfqId),
    data
  );
}

/** Studio: cancel an RFQ (PM only on the server). */
export function cancel(projectId: string, rfqId: string, data: CancelInput) {
  return apiPost<Rfq>(API.rfqCancel(projectId, rfqId), data);
}
