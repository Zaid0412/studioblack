const FORMATTER_CACHE = new Map<string, Intl.NumberFormat>();

/**
 * Format a numeric amount as currency. The `Intl.NumberFormat` instance is
 * cached per currency code (constructing one is comparatively expensive).
 */
export function formatCurrency(value: number, currency: string): string {
  let f = FORMATTER_CACHE.get(currency);
  if (!f) {
    f = new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    });
    FORMATTER_CACHE.set(currency, f);
  }
  return f.format(value);
}
