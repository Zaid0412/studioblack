import { apiGet, apiPatch } from "./client";
import { API } from "./routes";
import type { DbNotificationRow } from "@/types";

/** List all notifications for the current user (the /audit history). */
export function list() {
  return apiGet<DbNotificationRow[]>(API.notifications());
}

/** Mark specific notifications as read by their IDs. */
export function markRead(ids: string[]) {
  return apiPatch(API.notifications(), { ids });
}

/**
 * Mark every notification read. This is what empties the bell — notifications
 * are never hard-deleted, because /audit and the dashboard activity feed read
 * the same rows and want them after they've been read.
 */
export function markAllRead() {
  return apiPatch(API.notifications(), { markAllRead: true });
}
