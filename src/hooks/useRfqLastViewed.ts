"use client";

import { useEffect, useState } from "react";

/**
 * Tracks the "last viewed" timestamp for an RFQ in localStorage.
 * Returns the timestamp at the moment of first render (frozen — does NOT
 * update during the page session so the "new" badge keeps showing on
 * fresh quotes that arrive while the user is on the page; the badge
 * only clears after they leave + return).
 *
 * Writes the new timestamp on mount.
 */
export function useRfqLastViewed(rfqId: string): string | null {
  const [frozenAt] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    let stored: string | null = null;
    try {
      stored = window.localStorage.getItem(`rfq-last-viewed-${rfqId}`);
    } catch {
      // localStorage disabled (Safari private mode, etc.) — degrade silently.
    }
    return stored;
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(
        `rfq-last-viewed-${rfqId}`,
        new Date().toISOString()
      );
    } catch {
      // Quota exceeded or disabled — best-effort only.
    }
  }, [rfqId]);

  return frozenAt;
}

/**
 * Read-only variant: returns the last-viewed timestamp without writing.
 * Used by list pages that should not "consume" the new-ness.
 */
export function useRfqLastViewedReadOnly(rfqId: string): string | null {
  const [val] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    let stored: string | null = null;
    try {
      stored = window.localStorage.getItem(`rfq-last-viewed-${rfqId}`);
    } catch {
      // localStorage disabled (Safari private mode, etc.) — degrade silently.
    }
    return stored;
  });
  return val;
}
