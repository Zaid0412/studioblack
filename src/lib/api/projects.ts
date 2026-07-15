import { apiGet, apiPost, apiPatch, apiDelete } from "./client";
import { API } from "./routes";

/** List all projects. */
export function list<T>() {
  return apiGet<T[]>(API.projects());
}

/** Get a single project by ID. */
export function get<T>(id: string) {
  return apiGet<T>(API.project(id));
}

/** Create a new project. */
export function create<T>(data: {
  name: string;
  clientName?: string | null;
  clientEmail?: string | null;
  category?: string;
  deadline?: string | null;
  scope?: string;
  areaSqft?: number;
  estimationInr?: number;
  address?: string;
  city?: string;
  state?: string;
  lineIncrement?: number;
  phases?: { name: string }[];
  architectIds?: string[];
  pmIds?: string[];
}) {
  return apiPost<T>(API.projects(), data);
}

/** Update an existing project by ID. */
export function update<T>(
  id: string,
  data: {
    name?: string;
    clientName?: string | null;
    clientEmail?: string | null;
    deadline?: string | null;
    scope?: string | null;
    areaSqft?: number | null;
    estimationInr?: number | null;
    address?: string | null;
    city?: string | null;
    state?: string | null;
    status?: string;
    lineIncrement?: number;
    defaultCurrency?: string | null;
    defaultUnit?: string | null;
    defaultVatPct?: number | null;
    defaultContingencyPct?: number | null;
    defaultMinMarginPct?: number | null;
    defaultServiceChargePct?: number | null;
    architectIds?: string[];
    pmIds?: string[];
  }
) {
  return apiPatch<T>(API.project(id), data);
}

/** Archive a project (soft, reversible). */
export function remove(id: string) {
  return apiDelete(API.project(id));
}

/** Permanently delete a project and all its data (owner only, irreversible). */
export function destroy(id: string) {
  return apiDelete(API.projectPermanent(id));
}

/** Enable/disable a phase's visibility (non-destructive — data is preserved). */
export function setPhaseEnabled<T>(
  projectId: string,
  phaseId: string,
  enabled: boolean
) {
  return apiPatch<T>(API.projectPhase(projectId, phaseId), { enabled });
}

/** Enable/disable a workflow step's visibility (non-destructive). */
export function setStepEnabled<T>(
  projectId: string,
  stepId: string,
  enabled: boolean
) {
  return apiPatch<T>(API.projectStep(projectId, stepId), { enabled });
}
