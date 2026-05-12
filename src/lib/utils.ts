import { clsx, type ClassValue } from "clsx";
import { flushSync } from "react-dom";
import { twMerge } from "tailwind-merge";

/**
 * Merge Tailwind CSS class names with conflict resolution.
 *
 * Combines `clsx` (conditional classes) with `tailwind-merge` (deduplication)
 * so the last conflicting utility always wins.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Validate and sanitize a returnTo URL to prevent open redirects.
 * Only allows relative paths — rejects absolute URLs and protocol-relative URLs.
 */
export function getSafeReturnTo(
  returnTo: string | null,
  fallback = "/dashboard"
): string {
  if (!returnTo) return fallback;
  if (returnTo.startsWith("/") && !returnTo.startsWith("//")) return returnTo;
  return fallback;
}

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

/** Derive 1–2 character initials from a full name. */
export function deriveInitials(name: string): string {
  const initials = name
    .split(" ")
    .filter(Boolean)
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
  return initials || "?";
}
