/**
 * Format a pg NUMERIC string to a localised money display.
 *
 * `currency` is required on purpose: every row carries its own, and defaulting
 * it would let a caller silently render a USD row in the app's default currency.
 */
export function formatMoney(value: string | number, currency: string): string {
  const num = typeof value === "string" ? parseFloat(value) : value;
  if (!Number.isFinite(num)) return "—";
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(num);
  } catch {
    return `${num.toFixed(2)} ${currency}`;
  }
}

/** Format a percentage NUMERIC string for read-only display. */
export function formatPercent(value: string | null | undefined): string {
  if (value === null || value === undefined || value === "") return "—";
  const num = parseFloat(value);
  if (!Number.isFinite(num)) return "—";
  return `${num.toFixed(2)}%`;
}
