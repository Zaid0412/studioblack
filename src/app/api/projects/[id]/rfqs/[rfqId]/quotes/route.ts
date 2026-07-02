import { NextResponse } from "next/server";
import {
  getQuotesByRfq,
  submitOrUpdateQuote,
  logAuditSafe,
  AUDIT_ACTIONS,
} from "@/lib/queries";
import { withAuth } from "@/lib/withAuth";
import { parseRequest, enterQuoteSchema } from "@/lib/validations";
import { resolveRfqId } from "../../_helpers";

/**
 * GET /api/projects/[id]/rfqs/[rfqId]/quotes — every quote on this RFQ
 * with line items joined. Sweeps expired quotes before returning so the
 * caller sees `status='expired'` consistently. Order: on-time first
 * (is_late ASC), then by submission time.
 */
export const GET = withAuth(
  { projectAccess: true, blockedRoles: ["client", "vendor"] },
  async (_req, _ctx, params) => {
    const resolved = await resolveRfqId(params.id, params.rfqId);
    if (!resolved.ok) return resolved.response;

    const quotes = await getQuotesByRfq(resolved.rfqId);
    return NextResponse.json({ quotes });
  }
);

/**
 * POST /api/projects/[id]/rfqs/[rfqId]/quotes — a PM records a quote received
 * off-portal (email/WhatsApp/phone/…) on behalf of an already-invited vendor,
 * tagging the source + received date + evidence. Reuses the vendor-submit
 * path via `meta`, so it inherits the same rule: a price is required for every
 * RFQ item (full coverage — partial quotes aren't supported yet, per F10).
 */
export const POST = withAuth(
  { projectAccess: true, blockedRoles: ["client", "vendor"] },
  async (req, { user }, params) => {
    const resolved = await resolveRfqId(params.id, params.rfqId);
    if (!resolved.ok) return resolved.response;

    const parsed = await parseRequest(req, enterQuoteSchema);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    const result = await submitOrUpdateQuote(
      resolved.rfqId,
      parsed.data.vendorId,
      parsed.data,
      {
        responseSource: parsed.data.responseSource,
        receivedDate: parsed.data.receivedDate,
        enteredBy: user.id,
        attachments: parsed.data.attachments,
      }
    );

    if (!result.ok) {
      const map: Record<string, [number, string]> = {
        rfq_not_found: [404, "RFQ not found"],
        rfq_wrong_status: [409, "This RFQ no longer accepts quotes"],
        vendor_not_invited: [409, "Invite the vendor before entering a quote"],
        missing_items: [400, "A price is required for every RFQ item"],
        extra_items: [400, "Quote includes items not on this RFQ"],
        quote_locked: [409, "This quote can no longer be edited"],
      };
      const [status, error] = map[result.reason] ?? [400, result.reason];
      return NextResponse.json({ error }, { status });
    }

    await logAuditSafe({
      orgId: result.orgId,
      actorId: user.id,
      action: AUDIT_ACTIONS.QUOTE_ENTERED_MANUALLY,
      targetTable: "vendor_quote",
      targetId: result.quote.id,
      metadata: {
        vendorId: parsed.data.vendorId,
        responseSource: parsed.data.responseSource,
        isNew: result.isNew,
      },
    });

    return NextResponse.json({ quote: result.quote, isNew: result.isNew });
  }
);
