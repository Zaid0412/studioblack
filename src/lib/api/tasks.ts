import { apiGet, apiPost, apiPatch, apiDelete } from "./client";
import { API } from "./routes";

/**
 *
 */
export function list<T>(params?: Record<string, string>) {
  const qs = params ? new URLSearchParams(params).toString() : "";
  return apiGet<T>(`${API.tasks()}${qs ? `?${qs}` : ""}`);
}

/**
 *
 */
export function get<T>(id: string) {
  return apiGet<T>(API.task(id));
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
  return apiPost<T>(API.tasks(), data);
}

/**
 *
 */
export function update<T>(id: string, data: Record<string, unknown>) {
  return apiPatch<T>(API.task(id), data);
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
