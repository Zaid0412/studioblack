import { captureServerException } from "@/lib/posthog-server";

// register() is required by Next.js but has nothing to do here — the PostHog
// server client lazily constructs itself on first capture.
export async function register() {}

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
