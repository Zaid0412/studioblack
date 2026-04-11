/**
 * Shared time formatting utilities.
 *
 * Consolidates formatTimeAgo (dashboard, review), formatTimeShort (notifications),
 * and relativeTime (projects list) into one module.
 */

import { formatShortDate } from "./formatDate";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type TFunc = (key: string, values?: Record<string, any>) => string;

/**
 * Converts an ISO timestamp into a human-readable relative time string
 * using i18n translation keys: justNow, hoursAgo, daysAgo.
 * Falls back to formatted date for timestamps older than 7 days.
 */
export function formatTimeAgo(timestamp: string, t: TFunc): string {
  const now = new Date();
  const date = new Date(timestamp);
  const diffMs = now.getTime() - date.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffHours < 1) return t("justNow");
  if (diffHours < 24) return t("hoursAgo", { count: diffHours });
  if (diffDays < 7) return t("daysAgo", { count: diffDays });
  return formatShortDate(timestamp);
}

/** Short time display (e.g. "2:30 PM") for notification timestamps. */
export function formatTimeShort(timestamp: string, locale?: string): string {
  const date = new Date(timestamp);
  return date.toLocaleTimeString(locale, {
    hour: "numeric",
    minute: "2-digit",
  });
}

/** Compact relative time using Intl.RelativeTimeFormat (locale-aware). */
export function relativeTime(dateStr: string, locale?: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const diffMin = Math.floor(diffMs / 60000);
  const diffHrs = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffDays >= 7) return formatShortDate(dateStr, locale);

  const rtf = new Intl.RelativeTimeFormat(locale, {
    numeric: "always",
    style: "narrow",
  });
  if (diffMin < 60) return rtf.format(-Math.max(1, diffMin), "minute");
  if (diffHrs < 24) return rtf.format(-diffHrs, "hour");
  return rtf.format(-diffDays, "day");
}
