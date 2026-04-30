import posthog from "posthog-js";
import { authClient } from "@/lib/authClient";

/**
 * Sign the user out and clear the PostHog identity so subsequent anonymous
 * activity is not attributed to the previous user.
 */
export async function signOutAndReset(): Promise<void> {
  await authClient.signOut();
  posthog.reset();
}
