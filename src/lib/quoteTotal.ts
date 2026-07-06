import type { VendorQuoteItem } from "@/types";

/**
 * A quote's summed per-item unit prices — the quick comparison figure shown in
 * the quotes list + version history. NOTE: this is not multiplied by the RFQ
 * quantities; the true bid total (unit price × qty) lives in the comparison view.
 */
export function sumQuoteUnitPrices(items: VendorQuoteItem[]): number {
  return items.reduce((sum, item) => sum + Number(item.unit_price), 0);
}

/**
 * Whether a raw price-input string is a real bid on a line item: non-empty and
 * a finite, non-negative number. A blank line means "not quoting" that item
 * (§14 partial bidding) — only filled lines are submitted. Shared by the studio
 * and vendor-portal quote dialogs so the rule stays in one place.
 */
export function isPriceFilled(raw: string | undefined): boolean {
  if (raw === undefined || raw === "") return false;
  const price = Number(raw);
  return Number.isFinite(price) && price >= 0;
}
