import { apiGet, apiPost, apiPut } from "./client";
import { API } from "./routes";
import type { QuoteComparison, Rfq, VendorQuoteWithItems } from "@/types";
import type { z } from "zod";
import type {
  awardRfqSingleSchema,
  awardRfqSplitSchema,
  submitQuoteSchema,
  enterQuoteSchema,
} from "@/lib/validations";

type SubmitInput = z.input<typeof submitQuoteSchema>;
type EnterInput = z.input<typeof enterQuoteSchema>;
type AwardSingleInput = z.infer<typeof awardRfqSingleSchema>;
type AwardSplitInput = z.infer<typeof awardRfqSplitSchema>;

/** Studio: list every quote for an RFQ. */
export function list(projectId: string, rfqId: string) {
  return apiGet<{ quotes: VendorQuoteWithItems[] }>(
    API.rfqQuotes(projectId, rfqId)
  );
}

/** Studio: PM records a quote received off-portal on behalf of a vendor. */
export function enter(projectId: string, rfqId: string, data: EnterInput) {
  return apiPost<{ quote: VendorQuoteWithItems; isNew: boolean }>(
    API.rfqQuotes(projectId, rfqId),
    data
  );
}

/** Studio: PM records that an invited vendor declined off-portal (§14). */
export function decline(
  projectId: string,
  rfqId: string,
  vendorId: string,
  reason?: string | null
) {
  return apiPost<{ quote: VendorQuoteWithItems }>(
    API.rfqQuoteDecline(projectId, rfqId),
    { vendorId, reason: reason ?? null }
  );
}

/** Studio: single quote detail. */
export function get(projectId: string, rfqId: string, quoteId: string) {
  return apiGet<VendorQuoteWithItems>(API.rfqQuote(projectId, rfqId, quoteId));
}

/** Studio: full version history of a vendor's quote (current + superseded). */
export function versions(projectId: string, rfqId: string, quoteId: string) {
  return apiGet<{ versions: VendorQuoteWithItems[] }>(
    API.rfqQuoteVersions(projectId, rfqId, quoteId)
  );
}

/** Studio: side-by-side comparison data. */
export function comparison(projectId: string, rfqId: string) {
  return apiGet<QuoteComparison>(API.rfqComparison(projectId, rfqId));
}

/** Studio: flip a single submitted quote to under_review. */
export function review(projectId: string, rfqId: string, quoteId: string) {
  return apiPost<{ ok: true; quote: VendorQuoteWithItems }>(
    API.rfqQuoteReview(projectId, rfqId, quoteId),
    {}
  );
}

/** Studio: award the RFQ to one vendor (PM only). */
export function awardSingle(
  projectId: string,
  rfqId: string,
  data: AwardSingleInput
) {
  return apiPost<{ rfq: Rfq }>(API.rfqAward(projectId, rfqId), data);
}

/** Studio: per-item award (PM only). */
export function awardSplit(
  projectId: string,
  rfqId: string,
  data: AwardSplitInput
) {
  return apiPost<{ rfq: Rfq }>(API.rfqAwardSplit(projectId, rfqId), data);
}

/** Vendor portal: read the caller's own quote (null if not submitted yet). */
export function vendorGet(rfqId: string) {
  return apiGet<{ quote: VendorQuoteWithItems | null }>(
    API.vendorPortalRfqQuote(rfqId)
  );
}

/** Vendor portal: submit or revise the caller's quote. */
export function vendorSubmit(rfqId: string, data: SubmitInput) {
  return apiPut<{ quote: VendorQuoteWithItems; isNew: boolean }>(
    API.vendorPortalRfqQuote(rfqId),
    data
  );
}

/** Vendor portal: decline to quote this RFQ (§14). */
export function vendorDecline(rfqId: string, reason?: string | null) {
  return apiPut<{ quote: VendorQuoteWithItems }>(
    API.vendorPortalRfqDecline(rfqId),
    { reason: reason ?? null }
  );
}
