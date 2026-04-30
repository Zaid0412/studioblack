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

/**
 * Identifies the authenticated user with PostHog and links them to their
 * organization (group analytics) when present.
 *
 * Mount inside the protected layout once per session. Re-runs whenever the
 * user or org changes so subsequent events attribute correctly. Clients
 * (users without an org) skip the group call.
 */
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
    if (organizationId) {
      posthog.group("organization", organizationId, {
        name: organizationName,
      });
    }
  }, [userId, email, name, organizationId, organizationName]);

  return null;
}
