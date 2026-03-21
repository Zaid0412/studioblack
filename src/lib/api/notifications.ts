import { apiGet, apiPatch, apiDelete } from "./client";
import { API } from "./routes";
import type { DbNotificationRow } from "@/types";

/**
 *
 */
export function list() {
  return apiGet<DbNotificationRow[]>(API.notifications);
}

/**
 *
 */
export function markRead(ids: string[]) {
  return apiPatch(API.notifications, { ids });
}

/**
 *
 */
export function markAllRead() {
  return apiPatch(API.notifications, { markAllRead: true });
}

/**
 *
 */
export function remove(id: string) {
  return apiDelete(API.notifications, { id });
}

/**
 *
 */
export function clearAll() {
  return apiDelete(API.notifications);
}
