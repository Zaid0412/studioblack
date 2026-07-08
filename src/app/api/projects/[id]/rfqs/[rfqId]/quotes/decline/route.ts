import { NextResponse } from "next/server";
import { AUDIT_ACTIONS, declineQuote, logAuditSafe } from "@/lib/queries";
import { withAuth } from "@/lib/withAuth";
import { enterDeclineSchema, parseRequest } from "@/lib/validations";
import { resolveRfqId } from "../../../_helpers";

/**
 * POST /api/projects/[id]/rfqs/[rfqId]/quotes/decline — pm/architect records
 * that an invited vendor declined to quote off-portal (§14). Records a
 * `declined` quote (`response_source='manual'`) with an optional reason.
 */
export const POST = withAuth(
  { projectAccess: true, blockedRoles: ["client", "vendor"] },
  async (req, { user }, params) => {
    const resolved = await resolveRfqId(params.id, params.rfqId);
    if (!resolved.ok) return resolved.response;

    const parsed = await parseRequest(req, enterDeclineSchema);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    const result = await declineQuote(resolved.rfqId, parsed.data.vendorId, {
      responseSource: "manual",
      reason: parsed.data.reason ?? null,
      enteredBy: user.id,
    });
    if (!result.ok) {
      const map: Record<typeof result.reason, [number, string]> = {
        rfq_not_found: [404, "RFQ not found"],
        rfq_wrong_status: [409, "RFQ is not accepting quotes"],
        vendor_not_invited: [400, "Vendor is not invited to this RFQ"],
        quote_locked: [409, "Quote is locked and cannot be declined"],
      };
      const [status, error] = map[result.reason];
      return NextResponse.json({ error }, { status });
    }

    void logAuditSafe({
      orgId: result.orgId,
      actorId: user.id,
      action: AUDIT_ACTIONS.QUOTE_DECLINED,
      targetTable: "vendor_quote",
      targetId: result.quote.id,
      metadata: {
        rfq_id: resolved.rfqId,
        vendor_id: parsed.data.vendorId,
        reason: parsed.data.reason ?? null,
        entered_by: user.id,
      },
    });

    return NextResponse.json({ quote: result.quote });
  }
);
