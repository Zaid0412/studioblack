import posthog from "posthog-js";

/**
 * Custom event names tracked for product analytics + funnel analysis.
 *
 * Adding a new event: list it here so the union enforces no typos at the
 * call site, then call `trackEvent("…", { … })` after the user-visible
 * action succeeds. Don't fire on retries or programmatic refetches.
 */
export type AnalyticsEvent =
  | "project_created"
  | "attachment_uploaded"
  | "comment_added"
  | "task_completed"
  | "boq_imported"
  | "boq_exported";

/** Fire-and-forget custom event capture. No-op when PostHog isn't configured. */
export function trackEvent(
  event: AnalyticsEvent,
  properties?: Record<string, unknown>
): void {
  if (!process.env.NEXT_PUBLIC_POSTHOG_KEY) return;
  posthog.capture(event, properties);
}
