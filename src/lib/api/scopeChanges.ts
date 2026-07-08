import { apiGet, apiPost, apiPatch } from "./client";
import { API } from "./routes";
import type { ScopeChange, ScopeChangeListRow } from "@/types";
import type { z } from "zod";
import type {
  createScopeChangeSchema,
  updateScopeChangeSchema,
  listScopeChangesQuerySchema,
  ScopeChangeAction,
} from "@/lib/validations";

type CreateInput = z.infer<typeof createScopeChangeSchema>;
type UpdateInput = z.infer<typeof updateScopeChangeSchema>;
type ListParams = Partial<z.input<typeof listScopeChangesQuerySchema>>;

export interface ListScopeChangesResponse {
  rows: ScopeChangeListRow[];
  total: number;
  page: number;
  limit: number;
}

function buildQuery(params: ListParams): string {
  const search = new URLSearchParams();
  if (params.projectId) search.set("projectId", params.projectId);
  if (params.boqItemId) search.set("boqItemId", params.boqItemId);
  if (params.status) search.set("status", params.status);
  if (params.page !== undefined) search.set("page", String(params.page));
  if (params.limit !== undefined) search.set("limit", String(params.limit));
  const qs = search.toString();
  return qs ? `?${qs}` : "";
}

/** SWR cache key for the list. */
export function listKey(params: ListParams = {}): string {
  return `${API.scopeChanges()}${buildQuery(params)}`;
}

/** List scope changes with filters + pagination. */
export function list(params: ListParams = {}) {
  return apiGet<ListScopeChangesResponse>(
    `${API.scopeChanges()}${buildQuery(params)}`
  );
}

/** Fetch a single scope change with display joins. */
export function get(id: string) {
  return apiGet<ScopeChangeListRow>(API.scopeChange(id));
}

/** Raise a scope change against a BOQ item. */
export function create(data: CreateInput) {
  return apiPost<ScopeChange>(API.scopeChanges(), data);
}

/** Edit an unsubmitted (`requested`) scope change. */
export function update(id: string, data: UpdateInput) {
  return apiPatch<ScopeChange>(API.scopeChange(id), data);
}

/** Advance the lifecycle (submit / send_to_client / approve / reject_*). */
export function transition(
  id: string,
  action: ScopeChangeAction,
  note?: string
) {
  return apiPost<ScopeChange>(API.scopeChangeTransition(id), {
    action,
    ...(note ? { note } : {}),
  });
}

/** Execute an approved scope change (runs its impact). */
export function implement(id: string) {
  return apiPost<ScopeChange>(API.scopeChangeImplement(id), {});
}
