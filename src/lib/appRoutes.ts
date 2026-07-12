/**
 * Builders for the app's *page* routes. `src/lib/api/routes.ts` is the
 * equivalent for `/api/*` URLs.
 *
 * These exist because the same destination is built by more than one caller —
 * the RFQ link is sent both by email and by the notification bell, and if those
 * two drift the user is silently sent to different places for the same event.
 */

/** An RFQ's detail page. Built by both the quote emails and the notification bell. */
export function rfqDetailHref(projectId: string, rfqId: string): string {
  return `/projects/${projectId}/order/rfq/${rfqId}`;
}

/** The design review view. The route segment is `[designId]`, but it is an attachment id. */
export function designReviewHref(
  projectId: string,
  attachmentId: string
): string {
  return `/projects/${projectId}/review/${attachmentId}`;
}
