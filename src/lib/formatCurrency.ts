const FORMATTER_CACHE = new Map<string, Intl.NumberFormat>();

/**
 * Format a numeric amount as currency. The `Intl.NumberFormat` instance is
 * cached per currency code + fraction-digit count (constructing one is
 * comparatively expensive).
 */
export function formatCurrency(
  value: number,
  currency: string,
  maximumFractionDigits = 2
): string {
  const key = `${currency}:${maximumFractionDigits}`;
  let f = FORMATTER_CACHE.get(key);
  if (!f) {
    f = new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      maximumFractionDigits,
    });
    FORMATTER_CACHE.set(key, f);
  }
  return f.format(value);
}
