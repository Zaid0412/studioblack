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

/** Bulk-create starter categories. Idempotent — skips already-existing names. */
export function bulkCreate(data: BulkInput) {
  return apiPost<{ created: ElementCategory[]; skipped: string[] }>(
    API.elementCategoriesBulk(),
    data
  );
}
