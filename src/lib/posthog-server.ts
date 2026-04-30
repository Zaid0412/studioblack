import { PostHog } from "posthog-node";

let client: PostHog | null = null;

/**
 * Lazy singleton PostHog Node client.
 *
 * `flushAt: 1` and `flushInterval: 0` make every event ship immediately —
 * required on serverless (Vercel), where the process can be frozen between
 * invocations and batched events would be lost.
 */
function getClient(): PostHog | null {
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  const host = process.env.NEXT_PUBLIC_POSTHOG_HOST;
  if (!key) return null;

  if (!client) {
    client = new PostHog(key, {
      host,
      flushAt: 1,
      flushInterval: 0,
    });
  }
  return client;
}

/**
 * Capture a server-side exception for the PostHog Error Tracking product.
 *
 * `distinctId` should be the authenticated user ID when available; otherwise
 * pass `undefined` and PostHog will store the error against an anonymous id.
 */
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
