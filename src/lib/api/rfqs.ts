import { apiGet } from "./client";
import { API } from "./routes";
import type { RfqListRow, RfqWithItems, VendorLite } from "@/types";
import type { z } from "zod";
import type { listRfqsQuerySchema } from "@/lib/validations";

type ListParams = Partial<z.input<typeof listRfqsQuerySchema>>;

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
