import { apiGet, apiPatch } from "./client";
import { API } from "./routes";
import type { CategoryCodeConfig } from "@/types";
import type { z } from "zod";
import type { updateCategoryCodeConfigSchema } from "@/lib/validations";

type UpdateInput = z.infer<typeof updateCategoryCodeConfigSchema>;

/** Fetch the org's element-category coding config. */
export function get() {
  return apiGet<{ config: CategoryCodeConfig }>(API.categoryCodeConfig());
}

/** Update the org's coding config. */
export function update(data: UpdateInput) {
  return apiPatch<{ config: CategoryCodeConfig }>(
    API.categoryCodeConfig(),
    data
  );
}
