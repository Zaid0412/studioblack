import { apiGet, apiPost, apiPatch, apiDelete } from "./client";
import { API } from "./routes";
import type { DbPinComment } from "@/types";

export function list(projectId: string, attachmentId: string) {
  return apiGet<DbPinComment[]>(API.attachmentPins(projectId, attachmentId));
}

export function listReplies(
  projectId: string,
  attachmentId: string,
  pinId: string
) {
  return apiGet<DbPinComment[]>(
    API.attachmentPinReplies(projectId, attachmentId, pinId)
  );
}

export function create(
  projectId: string,
  attachmentId: string,
  data: {
    x_percent?: number | null;
    y_percent?: number | null;
    page?: number | null;
    content: string;
    request_approval?: boolean;
    assign_as_task?: {
      assigned_to: string;
      due_date?: string;
    };
    parent_id?: string;
  }
) {
  return apiPost<DbPinComment>(
    API.attachmentPins(projectId, attachmentId),
    data
  );
}

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

export function remove(projectId: string, attachmentId: string, pinId: string) {
  return apiDelete(API.attachmentPin(projectId, attachmentId, pinId));
}
