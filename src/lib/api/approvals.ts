import { apiGet, apiPost } from "./client";
import { API } from "./routes";

export type ApprovalDecision = "approved" | "changes_requested";

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
  data: { decision: ApprovalDecision; comment?: string }
) {
  return apiPost<T>(API.approvals(projectId), data);
}
