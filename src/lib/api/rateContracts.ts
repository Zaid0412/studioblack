import { apiGet, apiPost, apiPatch, apiDelete } from "./client";
import { API } from "./routes";
import type {
  RateContract,
  RateContractListRow,
  RateContractWithDetails,
  AvailableRate,
} from "@/types";
import type { z } from "zod";
import type {
  createRateContractSchema,
  updateRateContractSchema,
  addRateContractItemsSchema,
  listRateContractsQuerySchema,
  RateContractAction,
} from "@/lib/validations";

type CreateInput = z.infer<typeof createRateContractSchema>;
type UpdateInput = z.infer<typeof updateRateContractSchema>;
type AddItemsInput = z.infer<typeof addRateContractItemsSchema>;
type ListParams = Partial<z.input<typeof listRateContractsQuerySchema>>;

export interface ListRateContractsResponse {
  rows: RateContractListRow[];
  total: number;
  page: number;
  limit: number;
}

function buildQuery(params: ListParams): string {
  const search = new URLSearchParams();
  if (params.search) search.set("search", params.search);
  if (params.vendorId) search.set("vendorId", params.vendorId);
  if (params.status) search.set("status", params.status);
  if (params.sortBy) search.set("sortBy", params.sortBy);
  if (params.sortOrder) search.set("sortOrder", params.sortOrder);
  if (params.page !== undefined) search.set("page", String(params.page));
  if (params.limit !== undefined) search.set("limit", String(params.limit));
  const qs = search.toString();
  return qs ? `?${qs}` : "";
}

/** List rate contracts with filters + pagination + sort. */
export function list(params: ListParams = {}) {
  return apiGet<ListRateContractsResponse>(
    `${API.rateContracts()}${buildQuery(params)}`
  );
}

/** SWR cache key for the list. */
export function listKey(params: ListParams = {}): string {
  return `${API.rateContracts()}${buildQuery(params)}`;
}

/** Fetch a single rate contract with items + vendor name. */
export function get(id: string) {
  return apiGet<RateContractWithDetails>(API.rateContract(id));
}

/** Create a new rate contract in `draft` status. */
export function create(data: CreateInput) {
  return apiPost<RateContract>(API.rateContracts(), data);
}

/** Update header. Limited fields allowed once `active`. */
export function update(id: string, data: UpdateInput) {
  return apiPatch<RateContract>(API.rateContract(id), data);
}

/**
 * Advance the contract through its lifecycle via a single action
 * (submit / approve / request_changes / activate / suspend / resume / close /
 * cancel). Returns the updated contract.
 */
export function transition(
  id: string,
  action: RateContractAction,
  note?: string
) {
  return apiPost<RateContract>(API.rateContractTransition(id), {
    action,
    ...(note ? { note } : {}),
  });
}

/** Bulk-add or upsert items. */
export function addItems(id: string, data: AddItemsInput) {
  return apiPost<{ success: true; count: number }>(
    API.rateContractItems(id),
    data
  );
}

/** Remove a single item. */
export function removeItem(id: string, itemId: string) {
  return apiDelete<{ success: true }>(API.rateContractItem(id, itemId));
}

/** Active rates for an element across contracts (BOQ picker, focused). */
export function getByElement(elementId: string, vendorId?: string) {
  const qs = vendorId ? `?vendorId=${encodeURIComponent(vendorId)}` : "";
  return apiGet<{ rates: AvailableRate[] }>(
    `${API.rateContractsByElement(elementId)}${qs}`
  );
}

/** Browse mode: every active rate-contract item across the org (BOQ picker). */
export function availableRatesKey(search?: string): string {
  const qs = search ? `?search=${encodeURIComponent(search)}` : "";
  return `${API.rateContractAvailableRates()}${qs}`;
}
/** Fetch the flat list of active rate-contract items used by the BOQ picker. */
export function getAvailableRates(search?: string) {
  return apiGet<{ rates: AvailableRate[] }>(availableRatesKey(search));
}
