import { clsx, type ClassValue } from "clsx";
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
