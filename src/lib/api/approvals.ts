import { apiGet, apiPost } from "./client";

/**
 *
 */
export function list<T>(projectId: string) {
  return apiGet<T[]>(`/api/projects/${projectId}/approvals`);
}

/**
 *
 */
export function submit<T>(
  projectId: string,
  data: { decision: string; comment?: string }
) {
  return apiPost<T>(`/api/projects/${projectId}/approvals`, data);
}
