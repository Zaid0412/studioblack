import { apiGet, apiPatch, apiPost } from "./client";
import { API } from "./routes";
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
  const base = API.attachments(projectId);
  return apiGet<DbAttachment[]>(`${base}${qs ? `?${qs}` : ""}`);
}

/**
 *
 */
export function get(projectId: string, fileId: string) {
  return apiGet<DbAttachment>(API.attachment(projectId, fileId));
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
  return apiPost<T>(API.attachments(projectId), data);
}

/**
 *
 */
export function getReviewHistory(projectId: string, fileId: string) {
  return apiGet<DbAttachmentReview[]>(API.attachmentReview(projectId, fileId));
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
  return apiPatch(API.attachmentReview(projectId, fileId), data);
}

/**
 *
 */
export function getVersionHistory(projectId: string, versionGroup: string) {
  return apiGet<DbAttachment[]>(API.versionHistory(projectId, versionGroup));
}

/**
 *
 */
export function freeze(projectId: string, fileId: string) {
  return apiPatch(API.attachmentFreeze(projectId, fileId));
}

/**
 *
 */
export function unfreeze(projectId: string, fileId: string) {
  return apiPatch(API.attachmentUnfreeze(projectId, fileId));
}
