import posthog from "posthog-js";

// `api_host: "/ingest"` routes SDK traffic through our own domain via the
// rewrite in `next.config.ts`, so ad-blockers don't drop ingestion requests.
// Session replay sample rate is configured at the project level in PostHog
// (Settings → Session replay), not here.
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
    disable_session_recording: false,
    session_recording: { maskAllInputs: true },
    defaults: "2026-01-30",
  });

  if (process.env.NODE_ENV === "development") {
    (window as unknown as { posthog: typeof posthog }).posthog = posthog;
  }
}

export {};
