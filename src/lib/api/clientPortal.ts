import { apiGet } from "./client";
import { API } from "./routes";

/** List all projects visible to the authenticated client. */
export function listProjects<T>() {
  return apiGet<T[]>(API.clientProjects());
}
