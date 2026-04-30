import posthog from "posthog-js";

/**
 * PostHog browser init.
 *
 * Captures: errors, pageviews (history-aware for App Router), pageleave,
 * Core Web Vitals, and autocapture clicks/form submits (default-on).
 * Session recording is disabled at the SDK level — toggle from PostHog
 * Project Settings if/when we want session replay on errors.
 *
 * `api_host: "/ingest"` routes SDK traffic through our own domain via the
 * Next.js rewrite in `next.config.ts`, keeping requests from being dropped
 * by client-side ad-blockers.
 */
const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;

if (key && typeof window !== "undefined") {
  posthog.init(key, {
    api_host: "/ingest",
    ui_host: process.env.NEXT_PUBLIC_POSTHOG_HOST,
    capture_exceptions: true,
    capture_pageview: "history_change",
    capture_pageleave: true,
    capture_performance: { web_vitals: true },
    person_profiles: "identified_only",
    disable_session_recording: true,
    defaults: "2026-01-30",
  });

  if (process.env.NODE_ENV === "development") {
    (window as unknown as { posthog: typeof posthog }).posthog = posthog;
  }
}

export {};
