"use client";

import posthog from "posthog-js";
import { PostHogProvider as PHProvider } from "posthog-js/react";

/**
 * Wraps the app in PostHog's React context so feature-flag and capture
 * hooks (`useFeatureFlagEnabled`, `usePostHog`, etc.) work anywhere in
 * the tree.
 *
 * The PostHog client is initialized in `instrumentation-client.ts` — this
 * provider just hands the singleton to React.
 */
export function PostHogProvider({ children }: { children: React.ReactNode }) {
  return <PHProvider client={posthog}>{children}</PHProvider>;
}
