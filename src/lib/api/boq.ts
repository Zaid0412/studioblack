import type { z } from "zod";
import {
  apiGet,
  apiPost,
  apiPatch,
  apiDelete,
  apiBlobWithHeaders,
} from "./client";
import { API } from "./routes";
import type {
  BoqImportStrategy,
  boqImportConfirmSchema,
  createBoqItemSchema,
  updateBoqItemSchema,
} from "@/lib/validations";
import type {
  Boq,
  BoqParseResult,
  BoqSection,
  BoqItemWithComputed,
  BoqSummary,
  BoqWithDetails,
  BulkBoqImportResult,
} from "@/types";

// ── Header ──────────────────────────────────────────────────────────────────

/** GET the project's full BOQ (header + sections + items + summary). */
export function get(projectId: string) {
  return apiGet<BoqWithDetails>(API.boq(projectId));
}

export interface CreateBoqPayload {
  title: string;
  currency?: string;
  exchangeRate?: number;
  contingencyPct?: number;
  vatPct?: number;
  minimumMarginPct?: number;
  clientId?: string | null;
  architectId?: string | null;
  notes?: string | null;
  clientNotes?: string | null;
}

/** Create the project's BOQ header (currency, contingency, VAT, margin floor, …). */
export function create(projectId: string, data: CreateBoqPayload) {
  return apiPost<Boq>(API.boq(projectId), data);
}

export interface UpdateBoqPayload {
  boqId: string;
  title?: string;
  currency?: string;
  exchangeRate?: number;
  contingencyPct?: number;
  vatPct?: number;
  minimumMarginPct?: number;
  clientId?: string | null;
  architectId?: string | null;
  notes?: string | null;
  clientNotes?: string | null;
  status?:
    | "draft"
    | "submitted_to_client"
    | "client_approved"
    | "locked"
    | "superseded";
}

/** Patch BOQ header fields or transition its `status` (draft → submitted → approved → locked / superseded). */
export function update(projectId: string, data: UpdateBoqPayload) {
  return apiPatch<Boq>(API.boq(projectId), data);
}

// ── Sections ────────────────────────────────────────────────────────────────

export interface CreateSectionPayload {
  boqId: string;
  title: string;
  description?: string | null;
  sortOrder?: number;
  budgetCap?: number | null;
  isVisibleToClient?: boolean;
}

/** Create a new section under a BOQ — inserted at the end of the section list by default. */
export function createSection(projectId: string, data: CreateSectionPayload) {
  return apiPost<BoqSection>(API.boqSections(projectId), data);
}

/** Patch a section (title, description, budget cap, client-visibility). */
export function updateSection(
  projectId: string,
  sectionId: string,
  data: Partial<Omit<CreateSectionPayload, "boqId">>
) {
  return apiPatch<BoqSection>(API.boqSection(projectId, sectionId), data);
}

/** Delete a section. Items keep their data; their `section_id` becomes null via FK. */
export function deleteSection(projectId: string, sectionId: string) {
  return apiDelete(API.boqSection(projectId, sectionId));
}

/** Persist a new section ordering for a BOQ in a single bulk update. */
export function reorderSections(
  projectId: string,
  boqId: string,
  orderedIds: string[]
) {
  return apiPatch(API.boqSectionsReorder(projectId), { boqId, orderedIds });
}

// ── Items ───────────────────────────────────────────────────────────────────

/** Derived from the server Zod schema so the wire contract can't drift. */
export type CreateItemPayload = z.infer<typeof createBoqItemSchema> & {
  boqId: string;
};

/** Create a free-form BOQ item (not tied to a library element). */
export function createItem(projectId: string, data: CreateItemPayload) {
  return apiPost<BoqItemWithComputed>(API.boqItems(projectId), data);
}

/** Derived from the server Zod schema so the wire contract can't drift. */
export type UpdateItemPayload = z.infer<typeof updateBoqItemSchema>;

/** Patch a BOQ item with optimistic concurrency — `data.updatedAt` must match the server's row. */
export function updateItem(
  projectId: string,
  itemId: string,
  data: UpdateItemPayload
) {
  return apiPatch<BoqItemWithComputed>(API.boqItem(projectId, itemId), data);
}

/** Delete a BOQ item with optimistic concurrency — `updatedAt` guards against stale deletes. */
export function deleteItem(
  projectId: string,
  itemId: string,
  updatedAt: string
) {
  return apiDelete(API.boqItem(projectId, itemId), { updatedAt });
}

/** Persist a new ordering of items inside a section (or the unassigned bucket when `sectionId` is null). */
export function reorderItems(
  projectId: string,
  boqId: string,
  sectionId: string | null,
  orderedIds: string[]
) {
  return apiPatch(API.boqItemsReorder(projectId), {
    boqId,
    sectionId,
    orderedIds,
  });
}

/** Insert a BOQ item by copying the latest version of a library element (cost, unit, margin, …). */
export function addElement(
  projectId: string,
  data: {
    boqId: string;
    sectionId: string | null;
    elementId: string;
    quantity?: number;
  }
) {
  return apiPost<BoqItemWithComputed>(API.boqItemsFromElement(projectId), data);
}

// ── Summary ─────────────────────────────────────────────────────────────────

/** Fetch the rolled-up BOQ totals (cost, sell, margins, per-section subtotals). */
export function getSummary(projectId: string) {
  return apiGet<BoqSummary>(API.boqSummary(projectId));
}

// ── Excel Import / Export (Feature 6) ───────────────────────────────────────

/** Preview shape returned by the import route — parse result + BOQ id. */
export type BoqImportPreview = BoqParseResult & { boqId: string };

export type BoqImportConfirmInput = z.infer<typeof boqImportConfirmSchema>;

export { type BoqImportStrategy };

/** Upload an .xlsx file and receive a parsed preview. No DB writes yet. */
export function validateImport(
  projectId: string,
  file: File,
  signal?: AbortSignal
): Promise<BoqImportPreview> {
  const fd = new FormData();
  fd.append("file", file);
  return apiPost<BoqImportPreview>(API.boqImport(projectId), fd, { signal });
}

/** Execute a previously-previewed import with the chosen strategy. */
export function confirmImport(
  projectId: string,
  body: BoqImportConfirmInput,
  signal?: AbortSignal
): Promise<BulkBoqImportResult> {
  return apiPost<BulkBoqImportResult>(API.boqImportConfirm(projectId), body, {
    signal,
  });
}

/** Download the current BOQ as an .xlsx blob with parsed filename. */
export async function downloadExport(projectId: string): Promise<{
  blob: Blob;
  itemCount: number;
  filename: string | null;
}> {
  const { blob, headers } = await apiBlobWithHeaders(API.boqExport(projectId));
  return {
    blob,
    itemCount: Number(headers.get("X-Boq-Item-Count") ?? "0"),
    filename: parseContentDispositionFilename(
      headers.get("Content-Disposition")
    ),
  };
}

/**
 * Extract a filename from an RFC 5987 Content-Disposition header. Prefers the
 * UTF-8 `filename*=UTF-8''…` form; falls back to the ASCII `filename="…"`.
 */
function parseContentDispositionFilename(header: string | null): string | null {
  if (!header) return null;
  const starMatch = /filename\*\s*=\s*UTF-8''([^;]+)/i.exec(header);
  if (starMatch) {
    try {
      return decodeURIComponent(starMatch[1].trim());
    } catch {
      // fall through
    }
  }
  const plainMatch = /filename\s*=\s*"?([^";]+)"?/i.exec(header);
  return plainMatch ? plainMatch[1].trim() : null;
}
