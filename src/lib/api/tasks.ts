import { apiGet, apiPost, apiPatch, apiDelete } from "./client";

/**
 *
 */
export function list<T>(params?: Record<string, string>) {
  const qs = params ? new URLSearchParams(params).toString() : "";
  return apiGet<T>(`/api/tasks${qs ? `?${qs}` : ""}`);
}

/**
 *
 */
export function get<T>(id: string) {
  return apiGet<T>(`/api/tasks/${id}`);
}

/**
 *
 */
export function create<T>(data: {
  title: string;
  description?: string;
  projectId?: string;
  phaseId?: string;
  priority?: string;
  category?: string;
  assignedTo?: string;
  dueDate?: string | null;
}) {
  return apiPost<T>("/api/tasks", data);
}

/**
 *
 */
export function update<T>(id: string, data: Record<string, unknown>) {
  return apiPatch<T>(`/api/tasks/${id}`, data);
}

/**
 *
 */
export function remove(id: string) {
  return apiDelete(`/api/tasks/${id}`);
}

/**
 *
 */
export function toggleStar(id: string) {
  return apiPost(`/api/tasks/${id}/star`);
}

// --- Checklist ---

/**
 *
 */
export function getChecklist<T>(taskId: string) {
  return apiGet<T[]>(`/api/tasks/${taskId}/checklist`);
}

/**
 *
 */
export function addChecklistItem<T>(taskId: string, title: string) {
  return apiPost<T>(`/api/tasks/${taskId}/checklist`, { title });
}

/**
 *
 */
export function toggleChecklistItem(
  taskId: string,
  itemId: string,
  isDone: boolean
) {
  return apiPatch(`/api/tasks/${taskId}/checklist/${itemId}`, {
    is_done: isDone,
  });
}

/**
 *
 */
export function removeChecklistItem(taskId: string, itemId: string) {
  return apiDelete(`/api/tasks/${taskId}/checklist/${itemId}`);
}

/**
 *
 */
export function reorderChecklist(taskId: string, orderedIds: string[]) {
  return apiPatch(`/api/tasks/${taskId}/checklist/reorder`, { orderedIds });
}

// --- Task Attachments ---

/**
 *
 */
export function getAttachments<T>(taskId: string) {
  return apiGet<T[]>(`/api/tasks/${taskId}/attachments`);
}

/**
 *
 */
export function addAttachment<T>(
  taskId: string,
  data: { fileUrl: string; fileName: string; fileSize: number }
) {
  return apiPost<T>(`/api/tasks/${taskId}/attachments`, data);
}

/**
 *
 */
export function removeAttachment(taskId: string, attachmentId: string) {
  return apiDelete(`/api/tasks/${taskId}/attachments/${attachmentId}`);
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
  return apiPost(`/api/projects/${projectId}/tasks/${taskId}/review`, data);
}

/**
 *
 */
export function getPendingReview<T>(projectId: string) {
  return apiGet<T[]>(`/api/projects/${projectId}/tasks/pending-review`);
}
