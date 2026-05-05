import { apiGet, apiPost, apiPatch, apiDelete } from "./client";
import { API } from "./routes";
import type { TaskComment, TaskCommentAttachment } from "@/types";

interface ListResponse {
  comments: TaskComment[];
}

export interface CreateTaskCommentInput {
  body: string;
  attachments?: TaskCommentAttachment[];
}

export interface UpdateTaskCommentInput {
  body?: string;
  attachments?: TaskCommentAttachment[];
}

/** List comments on a task. */
export function list(taskId: string) {
  return apiGet<ListResponse>(API.taskComments(taskId));
}

/** Post a new comment. */
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
