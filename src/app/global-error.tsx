"use client";

import posthog from "posthog-js";
import { useEffect } from "react";

/**
 * Global error boundary — captures unhandled errors and reports to PostHog.
 *
 * NOTE: Strings are intentionally hardcoded here. global-error replaces the
 * entire <html>, so NextIntlClientProvider is not available and useTranslations
 * cannot be used. This is a last-resort fallback UI.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    if (!process.env.NEXT_PUBLIC_POSTHOG_KEY) return;
    posthog.captureException(error, { digest: error.digest });
  }, [error]);

  return (
    <html>
      <body>
        <h2>Something went wrong</h2>
        <button onClick={reset}>Try again</button>
      </body>
    </html>
  );
}
