import { apiGet, apiPost, apiPatch, apiDelete } from "./client";
import { API } from "./routes";
import type { Element, ElementWithDetails } from "@/types";
import type { z } from "zod";
import type {
  createElementSchema,
  updateElementSchema,
  listElementsQuerySchema,
} from "@/lib/validations";

type CreateInput = z.infer<typeof createElementSchema>;
type UpdateInput = z.infer<typeof updateElementSchema>;
type ListParams = Partial<z.input<typeof listElementsQuerySchema>>;

export interface ListElementsResponse {
  rows: Element[];
  total: number;
  page: number;
  limit: number;
}

function buildQuery(params: ListParams): string {
  const search = new URLSearchParams();
  if (params.search) search.set("search", params.search);
  if (params.categoryId) search.set("categoryId", params.categoryId);
  if (params.unit) search.set("unit", params.unit);
  if (params.isActive !== undefined)
    search.set("isActive", String(params.isActive));
  if (params.page !== undefined) search.set("page", String(params.page));
  if (params.limit !== undefined) search.set("limit", String(params.limit));
  if (params.tags && Array.isArray(params.tags)) {
    for (const tag of params.tags) search.append("tags", tag);
  }
  const qs = search.toString();
  return qs ? `?${qs}` : "";
}

/** List elements with filters + pagination. */
export function list(params: ListParams = {}) {
  return apiGet<ListElementsResponse>(`${API.elements()}${buildQuery(params)}`);
}

/** Build the SWR key for a filtered list — use this as the useSWR key. */
export function listKey(params: ListParams = {}): string {
  return `${API.elements()}${buildQuery(params)}`;
}

/** Fetch a single element with attributes + category breadcrumb. */
export function get(id: string) {
  return apiGet<ElementWithDetails>(API.element(id));
}

/** Create a new element. */
export function create(data: CreateInput) {
  return apiPost<ElementWithDetails>(API.elements(), data);
}

/** Update an element. */
export function update(id: string, data: UpdateInput) {
  return apiPatch<ElementWithDetails>(API.element(id), data);
}

/** Soft-delete (archive) an element. */
export function remove(id: string) {
  return apiDelete(API.element(id));
}

/** Duplicate an element — server picks a new `{code}-copy` suffix. */
export function duplicate(id: string) {
  return apiPost<ElementWithDetails>(API.elementDuplicate(id), {});
}

/** Restore a previously archived element. */
export function restore(id: string) {
  return apiPost<{ success: true }>(API.elementRestore(id), {});
}
