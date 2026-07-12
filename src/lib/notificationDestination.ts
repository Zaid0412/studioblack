import { DEFAULT_BOQ_SEGMENT } from "@/app/(dashboard)/projects/[id]/boq/_lib/tabs";
import { designReviewHref, rfqDetailHref } from "@/lib/appRoutes";
import type { Notification } from "@/types";

/** The routing-relevant subset of a notification. */
export type NotificationTarget = Pick<
  Notification,
  "type" | "projectId" | "taskId" | "rfqId" | "attachmentId" | "href"
>;

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
 * BOQ is the one type-driven case left — the row carries no BOQ item id (and a
 * phase transition can cover many items, so a single id couldn't represent it),
 * so the sub-tab can only be picked from the type. The producer
 * (`_phaseNotifications.ts`) interpolates it as `boq_item_${target}`, so the
 * `boq_` prefix is the only contract on offer; if it changes there, change it here.
 */
export function notificationDestination(n: NotificationTarget): string | null {
  if (n.href) return n.href;
  if (n.taskId) return `/tasks/${n.taskId}`;
  // Everything below is project-scoped, so without a project there is nowhere
  // to go -- even if the notification names an RFQ or a design.
  if (!n.projectId) return null;
  if (n.rfqId) return rfqDetailHref(n.projectId, n.rfqId);
  if (n.attachmentId) return designReviewHref(n.projectId, n.attachmentId);
  if (n.type.startsWith("boq_")) {
    return `/projects/${n.projectId}/boq/${DEFAULT_BOQ_SEGMENT}`;
  }
  return `/projects/${n.projectId}`;
}
