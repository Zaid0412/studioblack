import { apiGet, apiPatch, apiDelete } from "./client";
import type { DbNotificationRow } from "@/types";

/**
 *
 */
export function list() {
  return apiGet<DbNotificationRow[]>("/api/notifications");
}

/**
 *
 */
export function markRead(ids: string[]) {
  return apiPatch("/api/notifications", { ids });
}

/**
 *
 */
export function markAllRead() {
  return apiPatch("/api/notifications", { markAllRead: true });
}

/**
 *
 */
export function remove(id: string) {
  return apiDelete("/api/notifications", { id });
}

/**
 *
 */
export function clearAll() {
  return apiDelete("/api/notifications");
}
