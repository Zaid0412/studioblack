import { apiGet, apiPost } from "./client";
import type { DbComment } from "@/types";

/**
 *
 */
export function list(projectId: string) {
  return apiGet<DbComment[]>(`/api/projects/${projectId}/comments`);
}

/**
 *
 */
export function create(projectId: string, content: string) {
  return apiPost(`/api/projects/${projectId}/comments`, { content });
}
