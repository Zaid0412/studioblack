import { apiGet, apiPost, apiPatch, apiDelete } from "./client";
import { API } from "./routes";
import type { DbPinComment, PinShape } from "@/types";
import type { PinStatus } from "@/lib/validations";

/** Fetch all top-level pin comments for an attachment. */
export function list(projectId: string, attachmentId: string) {
  return apiGet<DbPinComment[]>(API.attachmentPins(projectId, attachmentId));
}

/** Fetch replies for a specific pin comment. */
export function listReplies(
  projectId: string,
  attachmentId: string,
  pinId: string
) {
  return apiGet<DbPinComment[]>(
    API.attachmentPinReplies(projectId, attachmentId, pinId)
  );
}

/** Create a new pin comment or reply. */
export function create(
  projectId: string,
  attachmentId: string,
  data: {
    x_percent?: number | null;
    y_percent?: number | null;
    page?: number | null;
    content: string;
    request_changes?: boolean;
    assign_as_task?: {
      assigned_to: string;
      due_date?: string;
    };
    parent_id?: string;
    shapes?: PinShape[];
  }
) {
  return apiPost<DbPinComment>(
    API.attachmentPins(projectId, attachmentId),
    data
  );
}

/** Toggle the resolved status of a pin comment. */
export function resolve(
  projectId: string,
  attachmentId: string,
  pinId: string,
  resolved: boolean
) {
  return apiPatch<DbPinComment>(
    API.attachmentPin(projectId, attachmentId, pinId),
    { resolved }
  );
}

/** Set a pin's 3-state markup status (Open / Resolved / Closed). */
export function setStatus(
  projectId: string,
  attachmentId: string,
  pinId: string,
  status: PinStatus
) {
  return apiPatch<DbPinComment>(
    API.attachmentPin(projectId, attachmentId, pinId),
    { status }
  );
}

/** Update the text content of a pin comment. */
export function editContent(
  projectId: string,
  attachmentId: string,
  pinId: string,
  content: string
) {
  return apiPatch<DbPinComment>(
    API.attachmentPin(projectId, attachmentId, pinId),
    { content }
  );
}

/** Move a pin to new coordinates on the document. */
export function reposition(
  projectId: string,
  attachmentId: string,
  pinId: string,
  coords: { x_percent: number; y_percent: number; page: number }
) {
  return apiPatch<DbPinComment>(
    API.attachmentPin(projectId, attachmentId, pinId),
    coords
  );
}

/** Delete a pin comment. */
export function remove(projectId: string, attachmentId: string, pinId: string) {
  return apiDelete(API.attachmentPin(projectId, attachmentId, pinId));
}
