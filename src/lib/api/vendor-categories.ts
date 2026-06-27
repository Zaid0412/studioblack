import { apiGet, apiPost, apiPatch, apiDelete } from "./client";
import { API } from "./routes";
import type { VendorCategory, VendorCategoryNode } from "@/types";
import type { z } from "zod";
import type {
  createVendorCategorySchema,
  updateVendorCategorySchema,
} from "@/lib/validations";

type CreateInput = z.infer<typeof createVendorCategorySchema>;
type UpdateInput = z.infer<typeof updateVendorCategorySchema>;

/** Fetch the full vendor-category tree for the current org. */
export function getTree() {
  return apiGet<{ tree: VendorCategoryNode[] }>(API.vendorCategories());
}

/** Create a new vendor category. */
export function create(data: CreateInput) {
  return apiPost<VendorCategory>(API.vendorCategories(), data);
}

/** Update a vendor category. */
export function update(id: string, data: UpdateInput) {
  return apiPatch<VendorCategory>(API.vendorCategory(id), data);
}

/** Delete a vendor category. */
export function remove(id: string) {
  return apiDelete(API.vendorCategory(id));
}
