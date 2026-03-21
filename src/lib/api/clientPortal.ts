import { apiGet } from "./client";
import { API } from "./routes";

/**
 *
 */
export function listProjects<T>() {
  return apiGet<T[]>(API.clientProjects());
}
