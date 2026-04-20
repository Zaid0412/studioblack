import { apiGet, apiPost, apiPatch, apiDelete } from "./client";
import { API } from "./routes";
import type { ElementCategory, ElementCategoryNode } from "@/types";

/** Fetch the full category tree for the current org. */
export function getTree() {
  return apiGet<{ tree: ElementCategoryNode[] }>(API.elementCategories());
}

/** Create a new category. */
export function create(data: {
  name: string;
  parentId?: string;
  codePrefix?: string;
  sortOrder?: number;
  icon?: string;
  color?: string;
}) {
  return apiPost<ElementCategory>(API.elementCategories(), data);
}

/** Update a category. */
export function update(
  id: string,
  data: {
    name?: string;
    codePrefix?: string | null;
    sortOrder?: number;
    icon?: string | null;
    color?: string | null;
    isActive?: boolean;
  }
) {
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
