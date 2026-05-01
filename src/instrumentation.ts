import type { Instrumentation } from "next";
import { captureServerException } from "@/lib/posthog-server";

/** Required by Next.js but a no-op — the PostHog server client lazily constructs on first capture. */
export async function register() {}

/** Forwards uncaught Next.js server errors (Server Components, Route Handlers, Server Actions) to PostHog. */
export const onRequestError: Instrumentation.onRequestError = async (
  err,
  request,
  context
) => {
  await captureServerException(err, {
    properties: {
      $exception_source: "nextjs.onRequestError",
      path: request.path,
      method: request.method,
      route_path: context.routePath,
      route_kind: context.routerKind,
      route_type: context.routeType,
    },
  });
};
