import { PostHog } from "posthog-node";

let client: PostHog | null = null;

function getClient(): PostHog | null {
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  const host = process.env.NEXT_PUBLIC_POSTHOG_HOST;
  if (!key) return null;

  if (!client) {
    // flushAt:1 / flushInterval:0 — required on serverless (Vercel) where the
    // process can be frozen between invocations and batched events would be lost.
    client = new PostHog(key, {
      host,
      flushAt: 1,
      flushInterval: 0,
    });
  }
  return client;
}

/** Reports a server-side error to PostHog Error Tracking. No-op when the SDK isn't configured. */
export async function captureServerException(
  error: unknown,
  context: {
    distinctId?: string;
    properties?: Record<string, unknown>;
  } = {}
): Promise<void> {
  const ph = getClient();
  if (!ph) return;

  ph.captureException(
    error instanceof Error ? error : new Error(String(error)),
    context.distinctId,
    context.properties
  );
  await ph.flush();
}

/**
 * Returns the flag value, or `fallback` when PostHog has no answer or is disabled.
 *
 * Forwards the runtime `environment` as a person property so flags gated on
 * deploy environment (preview / production) evaluate the same way they do
 * client-side, where `setPersonPropertiesForFlags` already sets it.
 */
export async function getServerFeatureFlag(
  key: string,
  distinctId: string,
  fallback: boolean
): Promise<boolean> {
  const ph = getClient();
  if (!ph) return fallback;

  const environment =
    process.env.NEXT_PUBLIC_VERCEL_ENV ??
    process.env.VERCEL_ENV ??
    "development";

  const result = await ph.isFeatureEnabled(key, distinctId, {
    personProperties: { environment },
  });
  return result ?? fallback;
}
