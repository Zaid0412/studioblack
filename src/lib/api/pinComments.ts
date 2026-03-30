import { apiGet, apiPost, apiPatch, apiDelete } from "./client";
import { API } from "./routes";
import type { DbPinComment } from "@/types";

export function list(projectId: string, attachmentId: string) {
  return apiGet<DbPinComment[]>(API.attachmentPins(projectId, attachmentId));
}

export function create(
  projectId: string,
  attachmentId: string,
  data: {
    x_percent: number;
    y_percent: number;
    page: number;
    content: string;
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

export function remove(
  projectId: string,
  attachmentId: string,
  pinId: string
) {
  return apiDelete(API.attachmentPin(projectId, attachmentId, pinId));
}
