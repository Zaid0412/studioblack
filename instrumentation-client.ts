import posthog from "posthog-js";

// `api_host: "/ingest"` routes SDK traffic through our own domain via the
// rewrite in `next.config.ts`, so ad-blockers don't drop ingestion requests.
// Session replay sample rate is configured at the project level in PostHog
// (Settings → Session replay), not here.
const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;

if (key && typeof window !== "undefined") {
  // Defer init off the hydration critical path. Running `posthog.init` at
  // module eval competes with hydration on the main thread (worse TBT/INP);
  // idle-deferring it costs nothing user-visible. `capture_pageview:
  // "history_change"` still fires the first pageview on init, and
  // `capture_performance.web_vitals` reports from buffered PerformanceObserver
  // entries, so a late attach still collects vitals.
  //
  // Accepted tradeoff: `capture_exceptions` only attaches at init, so an error
  // thrown in the up-to-2s pre-init window is NOT captured (no buffered replay
  // for exceptions, unlike vitals). Hydration-time errors are rare and covered
  // by Next's error boundaries; revisit with an eager error buffer if needed.
  const start = () => {
    posthog.init(key, {
      api_host: "/ingest",
      ui_host: process.env.NEXT_PUBLIC_POSTHOG_HOST,
      capture_exceptions: true,
      capture_pageview: "history_change",
      capture_pageleave: true,
      capture_performance: { web_vitals: true },
      person_profiles: "identified_only",
      // Don't pull the rrweb recorder (~110KB+) during hydration. Sampling
      // still lives at the project level; recording starts server-side per
      // the project replay sample rate, not on every page from the client.
      disable_session_recording: true,
      session_recording: { maskAllInputs: true },
      defaults: "2026-01-30",
    });

    // Lets flags target by deploy environment (e.g. preview-only rollout).
    posthog.setPersonPropertiesForFlags({
      environment: process.env.NEXT_PUBLIC_VERCEL_ENV ?? "development",
    });

    if (process.env.NODE_ENV === "development") {
      (window as unknown as { posthog: typeof posthog }).posthog = posthog;
    }
  };

  if ("requestIdleCallback" in window) {
    requestIdleCallback(start, { timeout: 2000 });
  } else {
    setTimeout(start, 1);
  }
}

export {};
