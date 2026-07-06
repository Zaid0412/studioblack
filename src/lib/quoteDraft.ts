/** Change-detection for the quote submit / revise forms. */

export interface QuoteDraftFields {
  /** Studio-only: response source + received date (portal has neither). */
  source?: string;
  receivedDate?: string | null;
  /** Studio-only: currency selector (portal inherits the RFQ currency). */
  currency?: string;
  validUntil?: string | null;
  deliveryPeriod?: string;
  paymentTerms?: string;
  notes?: string;
  /** Per-item unit prices in RFQ item order; null = "not quoting". */
  prices: Array<number | null>;
  attachments: { url: string; notes?: string | null }[];
}

/**
 * Serialise a quote draft to a stable string so the studio/portal dialogs can
 * tell whether the form actually differs from the quote being revised — a
 * revision that changed nothing would just create a pointless new version.
 *
 * Fields absent from a given form (e.g. portal has no source/currency) collapse
 * to the same defaults on both sides, so they never register as a change.
 */
export function serializeQuoteDraft(d: QuoteDraftFields): string {
  return JSON.stringify({
    source: d.source ?? null,
    receivedDate: d.receivedDate ?? null,
    currency: d.currency ?? null,
    validUntil: d.validUntil ?? null,
    deliveryPeriod: d.deliveryPeriod ?? "",
    paymentTerms: d.paymentTerms ?? "",
    notes: d.notes ?? "",
    prices: d.prices,
    attachments: d.attachments.map((a) => ({
      url: a.url,
      notes: a.notes ?? "",
    })),
  });
}
