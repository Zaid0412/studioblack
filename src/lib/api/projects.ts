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
  description?: string;
  deadline?: string | null;
  phases?: { name: string }[];
  architectIds?: string[];
}) {
  return apiPost<T>(API.projects(), data);
}

/** Update an existing project by ID. */
export function update<T>(
  id: string,
  data: {
    name?: string;
    clientName?: string | null;
    description?: string;
    deadline?: string | null;
  }
) {
  return apiPatch<T>(API.project(id), data);
}

/** Delete a project by ID. */
export function remove(id: string) {
  return apiDelete(API.project(id));
}
