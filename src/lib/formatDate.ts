/**
 * Shared date formatting utilities.
 *
 * All formatters use en-US locale with consistent options.
 * Centralises date display logic that was previously scattered
 * across 12+ components with inconsistent locale/format choices.
 */

/** "Apr 11" — short date without year. */
export function formatShortDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

/** "Apr 11, 2026" — date with year. */
export function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/** "Apr 11, 2:30 PM" — short date with time. */
export function formatShortDateTime(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/** "Apr 11, 2026, 2:30 PM" — full date with time. */
export function formatDateTime(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
