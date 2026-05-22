import { NextResponse } from "next/server";
import {
  AUDIT_ACTIONS,
  getQuoteDetail,
  logAuditSafe,
  setQuoteUnderReview,
} from "@/lib/queries";
import { withAuth } from "@/lib/withAuth";
import { resolveRfqId } from "../../../../_helpers";

/**
 * POST /api/projects/[id]/rfqs/[rfqId]/quotes/[quoteId]/review — flip a
 * quote from `submitted` to `under_review`. Optional manual step; the
 * award flow accepts both statuses, so the UI may skip this entirely.
 */
export const POST = withAuth(
  { projectAccess: true, blockedRoles: ["client", "vendor"] },
  async (_req, { user, orgId }, params) => {
    const resolved = await resolveRfqId(params.id, params.rfqId);
    if (!resolved.ok) return resolved.response;
    if (!params.quoteId) {
      return NextResponse.json({ error: "Missing quoteId" }, { status: 400 });
    }

    // Probe that the quote belongs to this RFQ before mutating — cross-RFQ
    // spoofing must 404, not 200.
    const existing = await getQuoteDetail(params.quoteId);
    if (!existing || existing.rfq_id !== resolved.rfqId) {
      return NextResponse.json({ error: "Quote not found" }, { status: 404 });
    }

    const result = await setQuoteUnderReview(params.quoteId);
    if (!result.ok) {
      if (result.reason === "not_found") {
        return NextResponse.json({ error: "Quote not found" }, { status: 404 });
      }
      return NextResponse.json(
        { error: "Quote is not in a state that can be moved to review" },
        { status: 409 }
      );
    }

    if (orgId) {
      void logAuditSafe({
        orgId,
        actorId: user.id,
        action: AUDIT_ACTIONS.QUOTE_UNDER_REVIEW,
        targetTable: "vendor_quote",
        targetId: params.quoteId,
        metadata: { rfq_id: resolved.rfqId },
      });
    }
    return NextResponse.json({ ok: true, quote: result.quote });
  }
);
