import { apiGet, apiPost, apiPatch, apiDelete, ApiError } from "./client";
import { API } from "./routes";
import type { ElementCategory, ElementCategoryNode } from "@/types";
import type { z } from "zod";
import type {
  createElementCategorySchema,
  updateElementCategorySchema,
  bulkCreateCategoriesSchema,
} from "@/lib/validations";
import type { CategoryParseResult } from "@/lib/excel/categoryParser";
import type {
  CategoryImportPlan,
  CategoryImportResult,
  CategoryPath,
} from "@/lib/queries/categoryImport";

type CreateInput = z.infer<typeof createElementCategorySchema>;
type UpdateInput = z.infer<typeof updateElementCategorySchema>;
type BulkInput = z.infer<typeof bulkCreateCategoriesSchema>;

/**
 * The preview: the parsed sheet, plus the diff it implies. `plan` is null when
 * any row failed to parse — a broken row would read as a deletion, so we won't
 * show a plan built on a sheet we couldn't fully understand.
 */
export interface CategoryParseResponse extends CategoryParseResult {
  plan: CategoryImportPlan | null;
}

export type {
  CategoryImportDelete,
  CategoryImportPlan,
  CategoryImportResult,
  CategoryPath,
} from "@/lib/queries/categoryImport";

/** Fetch the full category tree for the current org. */
export function getTree() {
  return apiGet<{ tree: ElementCategoryNode[] }>(API.elementCategories());
}

/** Create a new category. */
export function create(data: CreateInput) {
  return apiPost<ElementCategory>(API.elementCategories(), data);
}

/** Update a category. */
export function update(id: string, data: UpdateInput) {
  return apiPatch<ElementCategory>(API.elementCategory(id), data);
}

/** Delete a category. */
export function remove(id: string) {
  return apiDelete(API.elementCategory(id));
}

/** Reorder categories within a parent (or root level). */
export function reorder(parentId: string | null, orderedIds: string[]) {
  return apiPatch<{ ok: boolean }>(API.elementCategoriesReorder(), {
    parentId,
    orderedIds,
  });
}

/**
 * Bulk-create a chain (or a whole starter taxonomy). Idempotent — a node whose
 * name already exists under the same parent is reused, and its missing children
 * are still created. `leafIds` are the resolved ids of the deepest node of each
 * chain, in the order supplied, whether created here or already present.
 */
export function bulkCreate(data: BulkInput) {
  return apiPost<{
    created: ElementCategory[];
    skipped: string[];
    leafIds: string[];
  }>(API.elementCategoriesBulk(), data);
}

/**
 * Parse a taxonomy sheet and get back the plan it implies. Reads only — nothing
 * is written until `confirmImport`.
 */
export async function validateImport(
  file: File,
  signal?: AbortSignal
): Promise<CategoryParseResponse> {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(API.elementCategoriesImport(), {
    method: "POST",
    body: form,
    signal,
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError(
      res.status,
      body?.error ?? "Could not read that sheet",
      undefined,
      body
    );
  }
  return body as CategoryParseResponse;
}

/** Commit an import. Throws `ApiError` with status 409 when a delete is blocked. */
export function confirmImport(paths: CategoryPath[]) {
  return apiPost<CategoryImportResult>(API.elementCategoriesImportConfirm(), {
    paths,
  });
}

/** The org's current taxonomy, in the shape the importer accepts. */
export function downloadImportTemplate() {
  return API.elementCategoriesImportTemplate();
}
