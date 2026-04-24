import type { z } from "zod";
import { apiGet, apiPost, apiPatch, apiDelete } from "./client";
import { API } from "./routes";
import type {
  createBoqItemSchema,
  updateBoqItemSchema,
} from "@/lib/validations";
import type {
  Boq,
  BoqSection,
  BoqItemWithComputed,
  BoqSummary,
  BoqWithDetails,
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

export function createSection(projectId: string, data: CreateSectionPayload) {
  return apiPost<BoqSection>(API.boqSections(projectId), data);
}

export function updateSection(
  projectId: string,
  sectionId: string,
  data: Partial<Omit<CreateSectionPayload, "boqId">>
) {
  return apiPatch<BoqSection>(API.boqSection(projectId, sectionId), data);
}

export function deleteSection(projectId: string, sectionId: string) {
  return apiDelete(API.boqSection(projectId, sectionId));
}

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

export function createItem(projectId: string, data: CreateItemPayload) {
  return apiPost<BoqItemWithComputed>(API.boqItems(projectId), data);
}

/** Derived from the server Zod schema so the wire contract can't drift. */
export type UpdateItemPayload = z.infer<typeof updateBoqItemSchema>;

export function updateItem(
  projectId: string,
  itemId: string,
  data: UpdateItemPayload
) {
  return apiPatch<BoqItemWithComputed>(API.boqItem(projectId, itemId), data);
}

export function deleteItem(
  projectId: string,
  itemId: string,
  updatedAt: string
) {
  return apiDelete(API.boqItem(projectId, itemId), { updatedAt });
}

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

export function getSummary(projectId: string) {
  return apiGet<BoqSummary>(API.boqSummary(projectId));
}
