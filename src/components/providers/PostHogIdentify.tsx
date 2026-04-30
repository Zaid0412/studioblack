"use client";

import { useEffect } from "react";
import posthog from "posthog-js";

interface PostHogIdentifyProps {
  userId: string;
  email: string;
  name: string;
}

/**
 * Identifies the authenticated user with PostHog.
 *
 * Mount inside the protected layout once per session. Re-identifies whenever
 * the user changes (e.g. account switch) so subsequent events attribute to
 * the right person.
 */
export function PostHogIdentify({ userId, email, name }: PostHogIdentifyProps) {
  useEffect(() => {
    if (!process.env.NEXT_PUBLIC_POSTHOG_KEY) return;
    posthog.identify(userId, { email, name });
  }, [userId, email, name]);

  return null;
}
