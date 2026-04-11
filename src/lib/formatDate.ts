/**
 * Shared date formatting utilities.
 *
 * Locale defaults to `undefined` (browser locale) but can be overridden.
 * Centralises date display logic that was previously scattered
 * across 12+ components with inconsistent locale/format choices.
 */

/** "Apr 11" — short date without year. */
export function formatShortDate(dateStr: string, locale?: string): string {
  return new Date(dateStr).toLocaleDateString(locale, {
    month: "short",
    day: "numeric",
  });
}

/** "Apr 11, 2026" — date with year. */
export function formatDate(dateStr: string, locale?: string): string {
  return new Date(dateStr).toLocaleDateString(locale, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/** "Apr 11, 2:30 PM" — short date with time. */
export function formatShortDateTime(dateStr: string, locale?: string): string {
  return new Date(dateStr).toLocaleDateString(locale, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/** "Apr 11, 2026, 2:30 PM" — full date with time. */
export function formatDateTime(dateStr: string, locale?: string): string {
  return new Date(dateStr).toLocaleDateString(locale, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
