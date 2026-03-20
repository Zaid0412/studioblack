import { apiGet, apiPost, apiPatch, apiDelete } from "./client";

/**
 *
 */
export function list<T>() {
  return apiGet<T[]>("/api/projects");
}

/**
 *
 */
export function get<T>(id: string) {
  return apiGet<T>(`/api/projects/${id}`);
}

/**
 *
 */
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
  return apiPost<T>("/api/projects", data);
}

/**
 *
 */
export function update<T>(
  id: string,
  data: {
    name?: string;
    clientName?: string | null;
    description?: string;
    deadline?: string | null;
  }
) {
  return apiPatch<T>(`/api/projects/${id}`, data);
}

/**
 *
 */
export function remove(id: string) {
  return apiDelete(`/api/projects/${id}`);
}
