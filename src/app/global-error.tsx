"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

/**
 * Global error boundary — captures unhandled errors and reports to Sentry.
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
    Sentry.captureException(error);
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
