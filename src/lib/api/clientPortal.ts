import { apiGet } from "./client";

/**
 *
 */
export function listProjects<T>() {
  return apiGet<T[]>("/api/client/projects");
}
