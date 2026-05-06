import { apiPost, apiPatch, apiDelete } from "./client";
import { API } from "./routes";
import type { TaskComment, TaskCommentAttachment } from "@/types";

export interface CreateTaskCommentInput {
  body: string;
  attachments?: TaskCommentAttachment[];
}

export interface UpdateTaskCommentInput {
  body?: string;
  attachments?: TaskCommentAttachment[];
}

/**
 * Post a new comment. Comments are read via the `/activity` endpoint
 * (which merges comments + audit events), so there's no `.list` here —
 * surfaces fetch activity directly via SWR.
 */
export function create(taskId: string, input: CreateTaskCommentInput) {
  return apiPost<TaskComment>(API.taskComments(taskId), input);
}

/** Edit an existing comment (author only). */
export function update(
  taskId: string,
  commentId: string,
  input: UpdateTaskCommentInput
) {
  return apiPatch<TaskComment>(API.taskComment(taskId, commentId), input);
}

/** Delete a comment (author only). */
export function remove(taskId: string, commentId: string) {
  return apiDelete<{ success: true }>(API.taskComment(taskId, commentId));
}
