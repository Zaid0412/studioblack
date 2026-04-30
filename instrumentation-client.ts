import posthog from "posthog-js";

/**
 * PostHog browser init.
 *
 * Scope: error tracking only for now. Pageview/pageleave capture is
 * disabled because Vercel Analytics still owns page-level metrics.
 * Session recording is disabled at the SDK level — toggle it on later
 * from PostHog Project Settings if/when we want session replay on errors.
 *
 * `api_host: "/ingest"` routes SDK traffic through our own domain via the
 * Next.js rewrite in `next.config.ts`, which keeps requests from being
 * dropped by client-side ad-blockers.
 */
const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;

if (key && typeof window !== "undefined") {
  posthog.init(key, {
    api_host: "/ingest",
    ui_host: process.env.NEXT_PUBLIC_POSTHOG_HOST,
    capture_exceptions: true,
    person_profiles: "identified_only",
    disable_session_recording: true,
    capture_pageview: false,
    capture_pageleave: false,
    defaults: "2026-01-30",
  });

  if (process.env.NODE_ENV === "development") {
    (window as unknown as { posthog: typeof posthog }).posthog = posthog;
  }
}

export {};
