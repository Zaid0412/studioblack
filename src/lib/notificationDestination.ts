import { DEFAULT_BOQ_SEGMENT } from "@/app/(dashboard)/projects/[id]/boq/_lib/tabs";

/** The routing-relevant subset of a notification — satisfied by both the DB row and the client `Notification`. */
export interface NotificationTarget {
  type: string;
  projectId?: string | null;
  taskId?: string | null;
  /**
   * Explicit destination, for the client-only notifications that have no DB row
   * and so carry no entity ids (see the synthetic invitations in
   * `useNotifications`). Wins over the id-based rules below.
   */
  href?: string | null;
}

/**
 * Pick the deep-link target for a notification, or `null` when there is nowhere
 * to send the user — callers must treat null as "not clickable" rather than
 * silently doing nothing.
 *
 * Routing keys off the most specific entity the notification carries, not off
 * its type. That ordering matters: a task notification opens the task even when
 * it has no project, which a project-first rule can't express (standalone tasks
 * have `project_id` NULL).
 *
 * BOQ is the one type-driven case left — the row carries no BOQ item id, so the
 * sub-tab can only be picked from the type. The producer (`_phaseNotifications.ts`)
 * interpolates it as `boq_item_${target}`, so the `boq_` prefix is the only
 * contract on offer; if it changes there, change it here.
 */
export function notificationDestination(n: NotificationTarget): string | null {
  if (n.href) return n.href;
  if (n.taskId) return `/tasks/${n.taskId}`;
  if (!n.projectId) return null;
  if (n.type.startsWith("boq_")) {
    return `/projects/${n.projectId}/boq/${DEFAULT_BOQ_SEGMENT}`;
  }
  return `/projects/${n.projectId}`;
}
