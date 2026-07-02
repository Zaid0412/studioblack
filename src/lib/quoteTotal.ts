import type { VendorQuoteItem } from "@/types";

/**
 * A quote's summed per-item unit prices — the quick comparison figure shown in
 * the quotes list + version history. NOTE: this is not multiplied by the RFQ
 * quantities; the true bid total (unit price × qty) lives in the comparison view.
 */
export function sumQuoteUnitPrices(items: VendorQuoteItem[]): number {
  return items.reduce((sum, item) => sum + Number(item.unit_price), 0);
}
