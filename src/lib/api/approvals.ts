import { apiGet, apiPost } from "./client";
import { API } from "./routes";
import type { DbApproval } from "@/types";

export type ApprovalDecision = "approved" | "changes_requested";

/** List all approvals for a project. */
export function list(projectId: string) {
  return apiGet<DbApproval[]>(API.approvals(projectId));
}

/** Submit an approval decision for a project. */
export function submit(
  projectId: string,
  data: { decision: ApprovalDecision; comment?: string }
) {
  return apiPost<DbApproval>(API.approvals(projectId), data);
}
