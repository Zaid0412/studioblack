import { apiGet, apiPost, apiPatch, apiDelete } from "./client";
import { API } from "./routes";
import type { Task } from "@/types";

export interface TaskListResponse {
  tasks: Task[];
  counts: Record<string, number>;
  total: number;
}

export interface TaskUpdatePayload {
  title?: string;
  description?: string;
  status?: string;
  priority?: string;
  category?: string;
  projectId?: string;
  phaseId?: string | null;
  assignedTo?: string | null;
  dueDate?: string | null;
}

/**
 *
 */
export function list(params?: Record<string, string>) {
  const qs = params ? new URLSearchParams(params).toString() : "";
  return apiGet<TaskListResponse>(`${API.tasks()}${qs ? `?${qs}` : ""}`);
}

/**
 *
 */
export function get(id: string) {
  return apiGet<Task>(API.task(id));
}

/**
 *
 */
export function create(data: {
  title: string;
  description?: string;
  projectId?: string;
  phaseId?: string;
  priority?: string;
  category?: string;
  assignedTo?: string;
  dueDate?: string | null;
}) {
  return apiPost<Task>(API.tasks(), data);
}

/**
 *
 */
export function update(id: string, data: TaskUpdatePayload) {
  return apiPatch<Task>(API.task(id), data);
}

/**
 *
 */
export function remove(id: string) {
  return apiDelete(API.task(id));
}

/**
 *
 */
export function toggleStar(id: string) {
  return apiPost(API.taskStar(id));
}

// --- Checklist ---

/**
 *
 */
export function getChecklist<T>(taskId: string) {
  return apiGet<T[]>(API.taskChecklist(taskId));
}

/**
 *
 */
export function addChecklistItem<T>(taskId: string, title: string) {
  return apiPost<T>(API.taskChecklist(taskId), { title });
}

/**
 *
 */
export function toggleChecklistItem(
  taskId: string,
  itemId: string,
  isDone: boolean
) {
  return apiPatch(API.taskChecklistItem(taskId, itemId), {
    is_done: isDone,
  });
}

/**
 *
 */
export function removeChecklistItem(taskId: string, itemId: string) {
  return apiDelete(API.taskChecklistItem(taskId, itemId));
}

/**
 *
 */
export function reorderChecklist(taskId: string, orderedIds: string[]) {
  return apiPatch(API.taskChecklistReorder(taskId), { orderedIds });
}

// --- Task Attachments ---

/**
 *
 */
export function getAttachments<T>(taskId: string) {
  return apiGet<T[]>(API.taskAttachments(taskId));
}

/**
 *
 */
export function addAttachment<T>(
  taskId: string,
  data: { fileUrl: string; fileName: string; fileSize: number }
) {
  return apiPost<T>(API.taskAttachments(taskId), data);
}

/**
 *
 */
export function removeAttachment(taskId: string, attachmentId: string) {
  return apiDelete(API.taskAttachment(taskId, attachmentId));
}

// --- Task Review (project-scoped) ---

/**
 *
 */
export function submitReview(
  projectId: string,
  taskId: string,
  data: { action: string; comment?: string }
) {
  return apiPost(API.taskReview(projectId, taskId), data);
}

/**
 *
 */
export function getPendingReview<T>(projectId: string) {
  return apiGet<T[]>(API.tasksPendingReview(projectId));
}
