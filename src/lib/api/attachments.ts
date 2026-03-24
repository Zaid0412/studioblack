import { apiGet, apiPatch, apiPost } from "./client";
import { API } from "./routes";
import type { DbAttachment, DbAttachmentReview } from "@/types";

/** List all attachments for a project, optionally filtered by phase. */
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

/** Get a single attachment by ID. */
export function get(projectId: string, fileId: string) {
  return apiGet<DbAttachment>(API.attachment(projectId, fileId));
}

/** Create a new attachment record for a project. */
export function create(
  projectId: string,
  data: {
    fileUrl: string;
    fileName: string;
    description?: string;
    phaseId?: string | null;
    versionGroup?: string;
  }
) {
  return apiPost<DbAttachment>(API.attachments(projectId), data);
}

/** Get the review history for an attachment. */
export function getReviewHistory(projectId: string, fileId: string) {
  return apiGet<DbAttachmentReview[]>(API.attachmentReview(projectId, fileId));
}

/** Submit a review (approve/reject) for an attachment. */
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

/** Get all versions of a file by its version group. */
export function getVersionHistory(projectId: string, versionGroup: string) {
  return apiGet<DbAttachment[]>(API.versionHistory(projectId, versionGroup));
}

/** Freeze an attachment to prevent further changes. */
export function freeze(projectId: string, fileId: string) {
  return apiPatch(API.attachmentFreeze(projectId, fileId));
}

/** Unfreeze a previously frozen attachment. */
export function unfreeze(projectId: string, fileId: string) {
  return apiPatch(API.attachmentUnfreeze(projectId, fileId));
}
