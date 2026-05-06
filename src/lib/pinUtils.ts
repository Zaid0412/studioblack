import type { DbPinComment, Task } from "@/types";

/**
 * Build the deep-link URL to a pin comment in its file review view, or
 * `null` if the task isn't linked to one. Used by every place that opens
 * a task that originated as a review-page pin comment.
 */
export function pinCommentReviewHref(
  task: Pick<Task, "project_id" | "pin_attachment_id" | "pin_comment_id">
): string | null {
  if (!task.project_id || !task.pin_attachment_id || !task.pin_comment_id) {
    return null;
  }
  return `/projects/${task.project_id}/review/${task.pin_attachment_id}?comments=open&pinId=${task.pin_comment_id}`;
}

/** Sort pins by created_at ascending. */
export function sortPinsByDate(pins: DbPinComment[]): DbPinComment[] {
  return [...pins].sort(
    (a, b) =>
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );
}

/** Whether a pin has coordinates (is placed on the document). */
export function isPinned(p: DbPinComment): boolean {
  return p.x_percent !== null && p.y_percent !== null && p.page !== null;
}

/** Build a 1-based index map for pinned comments, ordered by created_at. */
export function buildPinIndexMap(pins: DbPinComment[]): Map<string, number> {
  const pinned = sortPinsByDate(pins.filter(isPinned));
  return new Map(pinned.map((p, i) => [p.id, i + 1]));
}
