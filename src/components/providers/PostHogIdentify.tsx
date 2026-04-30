"use client";

import { useEffect } from "react";
import posthog from "posthog-js";

interface PostHogIdentifyProps {
  userId: string;
  email: string;
  name: string;
  organizationId?: string;
  organizationName?: string;
}

/** Identifies the active user with PostHog and links them to their organization for group analytics. */
export function PostHogIdentify({
  userId,
  email,
  name,
  organizationId,
  organizationName,
}: PostHogIdentifyProps) {
  useEffect(() => {
    if (!process.env.NEXT_PUBLIC_POSTHOG_KEY) return;
    posthog.identify(userId, { email, name });
    if (organizationId && organizationName) {
      posthog.group("organization", organizationId, { name: organizationName });
    }
  }, [userId, email, name, organizationId, organizationName]);

  return null;
}
