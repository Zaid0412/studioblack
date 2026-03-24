import { apiGet, apiPost } from "./client";
import { API } from "./routes";
import type { DbApproval } from "@/types";

export type ApprovalDecision = "approved" | "changes_requested";

/**
 *
 */
export function list(projectId: string) {
  return apiGet<DbApproval[]>(API.approvals(projectId));
}

/**
 *
 */
export function submit(
  projectId: string,
  data: { decision: ApprovalDecision; comment?: string }
) {
  return apiPost<DbApproval>(API.approvals(projectId), data);
}
