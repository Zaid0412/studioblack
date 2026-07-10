# Defer PostHog init to idle + sample/lazy session replay

- **Tier / Impact / Effort:** T2 · Med-High · M
- **Area:** bundle
- **Files:** `instrumentation-client.ts:1-31` (synchronous `import posthog` + `posthog.init(...)`), `src/components/providers/PostHogProvider.tsx:1-9` (React context wrapper, imports the same singleton), `src/app/layout.tsx:51` (`<PostHogProvider>` wraps the app), `next.config.ts:86,90` (CSP already allows PostHog asset/ingest hosts — unchanged)

## Problem

`instrumentation-client.ts` imports `posthog-js` and calls `posthog.init(...)`
**synchronously** at module eval — Next.js runs the client instrumentation entry on every
page during hydration. Two costs:

- `disable_session_recording: false` (`instrumentation-client.ts:18`) means the SDK pulls
  the rrweb session-replay recorder (~110KB+) at runtime and starts recording, on top of
- `capture_performance: { web_vitals: true }` (`line 16`) and `capture_exceptions: true`
  (`line 13`) wiring.

All of this executes on the main thread during load, competing with hydration → worse TBT /
INP. `person_profiles: "identified_only"` (`line 17`) is already correct and keeps this
anonymous-light; the problem is purely the *timing* and the eager replay bundle.

## Fix

Defer initialization until after first paint / idle, and stop pulling replay eagerly:

1. **Idle-defer `init`.** Wrap the `posthog.init(...)` block so it runs on
   `requestIdleCallback` (with a `setTimeout` fallback for Safari), not at module eval:
   ```ts
   const start = () => posthog.init(key, { /* opts */ });
   if ("requestIdleCallback" in window) requestIdleCallback(start, { timeout: 2000 });
   else setTimeout(start, 1);
   ```
   Keep the `key && typeof window !== "undefined"` guard. `capture_pageview:
   "history_change"` + `capture_pageleave` still work post-init; the first pageview fires on
   init. If exception capture during the pre-init window matters, that's the one trade-off to
   weigh (see risks).
2. **Don't load replay eagerly.** Set `disable_session_recording: true` in the init opts so
   rrweb isn't pulled during hydration, then start recording on demand only when intended:
   `posthog.startSessionRecording()` — gated behind a feature flag (`useFlag`) or the
   project-level replay sample rate, called after init resolves. Alternatively keep
   server-side sampling but confirm the **project-level replay sample rate** in PostHog
   (Settings → Session replay) is not 100% — the comment at `instrumentation-client.ts:5-6`
   says sampling lives there, so verify the actual value before deciding whether client-side
   gating is even needed.
3. `PostHogProvider` and `setPersonPropertiesForFlags` (`instrumentation-client.ts:24-26`)
   need no structural change — the provider just wraps the singleton; flags resolve once
   `init` runs. Confirm nothing reads `posthog` before idle-init in a way that breaks (the
   dev-only `window.posthog` assignment at `line 29` can move inside `start`).

## Verification

- Performance panel (or a Lighthouse trace) on a cold dashboard load: main-thread work during
  the hydration window drops; the rrweb chunk no longer loads at startup. Compare TBT/INP
  before/after.
- PostHog still captures: after idle, confirm a pageview + a custom event
  (`trackEvent(...)` from `src/lib/analytics`) land in the PostHog live events view. Flags
  still resolve (a `useFlag`-gated UI element behaves correctly).
- Session replay only records when intended (flag on / sample hit), not on every page.
- Confirm the project-level replay sample rate value and document it.
- `npm run check`.

## Risks / notes

- **Exception capture gap**: deferring `init` means `capture_exceptions` won't catch errors
  thrown in the ~0-2s pre-init window. If early-error capture is important, keep a minimal
  synchronous error listener that buffers and flushes to PostHog after init, or accept the
  gap (usually fine — hydration-time errors are rare and caught by Next's error boundaries).
- Don't change the `/ingest` reverse-proxy setup (`api_host: "/ingest"`,
  `instrumentation-client.ts:11`, backed by rewrites in `next.config.ts:24-35`) — it's what
  keeps ad-blockers from dropping ingestion. Deferring init doesn't affect it.
- `capture_performance.web_vitals` measures real user vitals — deferring init slightly delays
  when the SDK attaches, but web-vitals are collected via buffered `PerformanceObserver`
  entries, so late attach still reports them. Verify vitals still arrive.
- No CSP change needed; PostHog hosts already allow-listed (`next.config.ts:86,90`).
