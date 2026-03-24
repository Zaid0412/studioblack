import { apiGet, apiPatch, apiDelete } from "./client";
import { API } from "./routes";
import type { DbNotificationRow } from "@/types";

/** List all notifications for the current user. */
export function list() {
  return apiGet<DbNotificationRow[]>(API.notifications());
}

/** Mark specific notifications as read by their IDs. */
export function markRead(ids: string[]) {
  return apiPatch(API.notifications(), { ids });
}

/** Mark all notifications as read. */
export function markAllRead() {
  return apiPatch(API.notifications(), { markAllRead: true });
}

/** Delete a single notification by ID. */
export function remove(id: string) {
  return apiDelete(API.notifications(), { id });
}

/** Delete all notifications for the current user. */
export function clearAll() {
  return apiDelete(API.notifications());
}
