import { apiGet, apiPost } from "./client";
import { API } from "./routes";

/**
 *
 */
export function list<T>(projectId: string) {
  return apiGet<T[]>(API.approvals(projectId));
}

/**
 *
 */
export function submit<T>(
  projectId: string,
  data: { decision: string; comment?: string }
) {
  return apiPost<T>(API.approvals(projectId), data);
}
