import { apiGet, apiPost } from "./client";
import { API } from "./routes";
import type { DbComment } from "@/types";

/**
 *
 */
export function list(projectId: string) {
  return apiGet<DbComment[]>(API.comments(projectId));
}

/**
 *
 */
export function create(projectId: string, content: string) {
  return apiPost(API.comments(projectId), { content });
}
