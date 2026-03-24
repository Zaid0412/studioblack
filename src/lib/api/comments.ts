import { apiGet, apiPost } from "./client";
import { API } from "./routes";
import type { DbComment } from "@/types";

/** List all comments for a project. */
export function list(projectId: string) {
  return apiGet<DbComment[]>(API.comments(projectId));
}

/** Post a new comment on a project. */
export function create(projectId: string, content: string) {
  return apiPost(API.comments(projectId), { content });
}
