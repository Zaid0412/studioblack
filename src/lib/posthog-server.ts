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

/** Returns the flag value, or `fallback` when PostHog has no answer or is disabled. */
export async function getServerFeatureFlag(
  key: string,
  distinctId: string,
  fallback: boolean
): Promise<boolean> {
  const ph = getClient();
  if (!ph) return fallback;

  const result = await ph.isFeatureEnabled(key, distinctId);
  return result ?? fallback;
}
