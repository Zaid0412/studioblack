import { apiGet, apiPost, apiPatch, apiDelete } from "./client";
import { API } from "./routes";
import type { Division, DivisionUsage } from "@/types";
import type { z } from "zod";
import type {
  createDivisionSchema,
  updateDivisionSchema,
} from "@/lib/validations";

type CreateInput = z.infer<typeof createDivisionSchema>;
type UpdateInput = z.infer<typeof updateDivisionSchema>;

/** Fetch the org's BOQ division library. */
export function list() {
  return apiGet<{ divisions: Division[] }>(API.divisions());
}

/** Add a division to the library. */
export function create(data: CreateInput) {
  return apiPost<Division>(API.divisions(), data);
}

/** Rename / enable / disable / set-default a division. */
export function update(id: string, data: UpdateInput) {
  return apiPatch<Division>(API.division(id), data);
}

/** Delete a division (409 when it's still referenced by a BOQ section). */
export function remove(id: string) {
  return apiDelete(API.division(id));
}

/** Projects (+ counts) that reference the division; empty ⇒ safe to delete. */
export function usage(id: string) {
  return apiGet<{ usage: DivisionUsage[] }>(API.divisionUsage(id));
}

/** Set the display order of the org's divisions. */
export function reorder(orderedIds: string[]) {
  return apiPatch<{ ok: boolean }>(API.divisionsReorder(), { orderedIds });
}

/** Re-seed any missing default divisions (idempotent). */
export function restoreDefaults() {
  return apiPost<{ added: number; divisions: Division[] }>(
    API.divisionsRestore(),
    {}
  );
}
