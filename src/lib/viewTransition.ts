"use client";

import { flushSync } from "react-dom";

/**
 * Run a state update inside a View Transition so the browser can crossfade
 * DOM changes. `flushSync` forces React to apply the update synchronously
 * inside the callback so the browser captures the "after" snapshot. Falls
 * back to a plain update on browsers without the API.
 */
export function withViewTransition(update: () => void): void {
  const doc =
    typeof document !== "undefined"
      ? (document as Document & {
          startViewTransition?: (cb: () => void) => unknown;
        })
      : null;
  if (doc?.startViewTransition) {
    doc.startViewTransition(() => flushSync(update));
  } else {
    update();
  }
}
