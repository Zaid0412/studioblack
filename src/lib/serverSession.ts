import { cache } from "react";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";

/**
 * Per-request-cached session validation.
 *
 * `auth.api.getSession()` does a DB lookup (session validity + expiry). Nested
 * dashboard layouts (`projects/new`, `vendor-portal`) each
 * validate the session on top of the parent `(dashboard)` layout in the same
 * render pass. Wrapping it in React `cache()` — with no arguments, so it reads
 * `headers()` itself and every call shares one cache key — collapses all of
 * them to a single DB round-trip per request. Outside a request context
 * (tests/scripts) `cache()` is a transparent passthrough.
 */
export const getServerSession = cache(async () => {
  return auth.api.getSession({ headers: await headers() });
});
