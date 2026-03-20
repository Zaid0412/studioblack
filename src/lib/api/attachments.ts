import { apiGet, apiPatch, apiPost } from "./client";
import type { DbAttachment, DbAttachmentReview } from "@/types";

/**
 *
 */
export function list(
  projectId: string,
  opts?: { phaseId?: string; all?: boolean }
) {
  const params = new URLSearchParams();
  if (opts?.phaseId) params.set("phaseId", opts.phaseId);
  if (opts?.all) params.set("all", "true");
  const qs = params.toString();
  return apiGet<DbAttachment[]>(
    `/api/projects/${projectId}/attachments${qs ? `?${qs}` : ""}`
  );
}

/**
 *
 */
export function get(projectId: string, fileId: string) {
  return apiGet<DbAttachment>(
    `/api/projects/${projectId}/attachments/${fileId}`
  );
}

/**
 *
 */
export function create<T>(
  projectId: string,
  data: {
    fileUrl: string;
    fileName: string;
    description?: string;
    phaseId?: string | null;
    versionGroup?: string;
  }
) {
  return apiPost<T>(`/api/projects/${projectId}/attachments`, data);
}

/**
 *
 */
export function getReviewHistory(projectId: string, fileId: string) {
  return apiGet<DbAttachmentReview[]>(
    `/api/projects/${projectId}/attachments/${fileId}/review`
  );
}

/**
 *
 */
export function submitReview(
  projectId: string,
  fileId: string,
  data: {
    status: "approved" | "rejected";
    comment?: string;
    annotatedFileUrl?: string;
    annotationCount?: number;
  }
) {
  return apiPatch(
    `/api/projects/${projectId}/attachments/${fileId}/review`,
    data
  );
}

/**
 *
 */
export function getVersionHistory(projectId: string, versionGroup: string) {
  return apiGet<DbAttachment[]>(
    `/api/projects/${projectId}/versions/${versionGroup}`
  );
}

/**
 *
 */
export function unfreeze(projectId: string, fileId: string) {
  return apiPatch(`/api/projects/${projectId}/attachments/${fileId}/unfreeze`);
}
