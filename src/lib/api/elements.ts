import {
  apiGet,
  apiPost,
  apiPatch,
  apiDelete,
  apiBlobWithHeaders,
} from "./client";
import { API } from "./routes";
import type { Element, ElementWithDetails } from "@/types";
import type { z } from "zod";
import type {
  createElementSchema,
  updateElementSchema,
  listElementsQuerySchema,
  importConfirmSchema,
  DuplicateStrategy,
} from "@/lib/validations";
import type { ParseResult } from "@/lib/excel/elementParser";

type CreateInput = z.infer<typeof createElementSchema>;
type UpdateInput = z.infer<typeof updateElementSchema>;
type ListParams = Partial<z.input<typeof listElementsQuerySchema>>;
type ConfirmInput = z.infer<typeof importConfirmSchema>;

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

/** Fetch every version of an element's version_group, newest first. */
export function getVersionHistory(id: string) {
  return apiGet<{ versions: Element[] }>(API.elementVersions(id));
}

export interface ImportConfirmResult {
  inserted: number;
  updated: number;
  skipped: number;
  versioned: number;
  failed: Array<{ rowNumber: number; code: string; error: string }>;
}

/** Upload an .xlsx file, return per-row parse results for the preview table. */
export function validateImport(
  file: File,
  signal?: AbortSignal
): Promise<ParseResult> {
  const fd = new FormData();
  fd.append("file", file);
  return apiPost<ParseResult>(API.elementsImport(), fd, { signal });
}

/** Execute a previously-previewed import with the user's chosen strategy. */
export function confirmImport(
  body: ConfirmInput,
  signal?: AbortSignal
): Promise<ImportConfirmResult> {
  return apiPost<ImportConfirmResult>(API.elementsImportConfirm(), body, {
    signal,
  });
}

export type { DuplicateStrategy };

/** Download the current filtered element library as an .xlsx blob. */
export async function downloadExport(params: ListParams = {}): Promise<{
  blob: Blob;
  truncated: boolean;
  total: number;
  filename: string | null;
}> {
  const { blob, headers } = await apiBlobWithHeaders(
    API.elementsExport(buildQuery(params))
  );
  return {
    blob,
    truncated: headers.get("X-Export-Truncated") === "true",
    total: Number(headers.get("X-Element-Total") ?? "0"),
    filename: parseContentDispositionFilename(
      headers.get("Content-Disposition")
    ),
  };
}

/**
 * Extract a filename from an RFC 5987 Content-Disposition header.
 * Prefers the UTF-8 `filename*=UTF-8''…` form, falls back to the ASCII
 * `filename="…"` form. Returns null when the header is absent or malformed.
 */
function parseContentDispositionFilename(header: string | null): string | null {
  if (!header) return null;
  const starMatch = /filename\*\s*=\s*UTF-8''([^;]+)/i.exec(header);
  if (starMatch) {
    try {
      return decodeURIComponent(starMatch[1].trim());
    } catch {
      // fall through to plain filename
    }
  }
  const plainMatch = /filename\s*=\s*"?([^";]+)"?/i.exec(header);
  return plainMatch ? plainMatch[1].trim() : null;
}
