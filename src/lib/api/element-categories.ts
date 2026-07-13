import { apiGet, apiPost, apiPatch, apiDelete } from "./client";
import { API } from "./routes";
import type { ElementCategory, ElementCategoryNode } from "@/types";
import type { z } from "zod";
import type {
  createElementCategorySchema,
  updateElementCategorySchema,
  bulkCreateCategoriesSchema,
} from "@/lib/validations";

type CreateInput = z.infer<typeof createElementCategorySchema>;
type UpdateInput = z.infer<typeof updateElementCategorySchema>;
type BulkInput = z.infer<typeof bulkCreateCategoriesSchema>;

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
