import { apiGet, apiPost, apiPatch, apiDelete } from "./client";
import { API } from "./routes";
import type {
  Task,
  ChecklistItem,
  TaskAttachment,
  DbPendingTask,
} from "@/types";

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

/** List tasks with optional query-string filters. */
export function list(params?: Record<string, string>) {
  const qs = params ? new URLSearchParams(params).toString() : "";
  return apiGet<TaskListResponse>(`${API.tasks()}${qs ? `?${qs}` : ""}`);
}

/** Get a single task by ID. */
export function get(id: string) {
  return apiGet<Task>(API.task(id));
}

/** Create a new task. */
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

/** Update a task by ID. */
export function update(id: string, data: TaskUpdatePayload) {
  return apiPatch<Task>(API.task(id), data);
}

/** Delete a task by ID. */
export function remove(id: string) {
  return apiDelete(API.task(id));
}

/** Toggle the starred state of a task. */
export function toggleStar(id: string) {
  return apiPost(API.taskStar(id));
}

// --- Checklist ---

/** Get all checklist items for a task. */
export function getChecklist(taskId: string) {
  return apiGet<ChecklistItem[]>(API.taskChecklist(taskId));
}

/** Add a new checklist item to a task. */
export function addChecklistItem(taskId: string, title: string) {
  return apiPost<ChecklistItem>(API.taskChecklist(taskId), { title });
}

/** Toggle the done state of a checklist item. */
export function toggleChecklistItem(
  taskId: string,
  itemId: string,
  isDone: boolean
) {
  return apiPatch(API.taskChecklistItem(taskId, itemId), {
    is_done: isDone,
  });
}

/** Remove a checklist item from a task. */
export function removeChecklistItem(taskId: string, itemId: string) {
  return apiDelete(API.taskChecklistItem(taskId, itemId));
}

/** Reorder checklist items by providing ordered IDs. */
export function reorderChecklist(taskId: string, orderedIds: string[]) {
  return apiPatch(API.taskChecklistReorder(taskId), { orderedIds });
}

// --- Task Attachments ---

/** Get all attachments for a task. */
export function getAttachments(taskId: string) {
  return apiGet<TaskAttachment[]>(API.taskAttachments(taskId));
}

/** Add an attachment to a task. */
export function addAttachment(
  taskId: string,
  data: { fileUrl: string; fileName: string; fileSize: number }
) {
  return apiPost<TaskAttachment>(API.taskAttachments(taskId), data);
}

/** Remove an attachment from a task. */
export function removeAttachment(taskId: string, attachmentId: string) {
  return apiDelete(API.taskAttachment(taskId, attachmentId));
}

// --- Task Review (project-scoped) ---

/** Submit a review action for a task within a project. */
export function submitReview(
  projectId: string,
  taskId: string,
  data: { action: string; comment?: string }
) {
  return apiPost(API.taskReview(projectId, taskId), data);
}

/** Get tasks pending review for a project. */
export function getPendingReview(projectId: string) {
  return apiGet<DbPendingTask[]>(API.tasksPendingReview(projectId));
}
