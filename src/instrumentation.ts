import { captureServerException } from "@/lib/posthog-server";

/**
 * Next.js instrumentation hook.
 *
 * `register` is intentionally a no-op — the PostHog server client lazily
 * constructs itself on first capture, so there's nothing to initialize here.
 */
export async function register() {}

/**
 * Invoked by Next.js for every uncaught error thrown in a Server Component,
 * Route Handler, or Server Action. Forwards the error to PostHog Error
 * Tracking. Signature matches Next.js's expected `onRequestError`.
 */
export async function onRequestError(
  err: unknown,
  request: { path?: string; method?: string; headers?: Record<string, string> },
  context: { routerKind?: string; routePath?: string; routeType?: string }
): Promise<void> {
  await captureServerException(err, {
    properties: {
      $exception_source: "nextjs.onRequestError",
      path: request?.path,
      method: request?.method,
      route_path: context?.routePath,
      route_kind: context?.routerKind,
      route_type: context?.routeType,
    },
  });
}
