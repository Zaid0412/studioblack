import { NextResponse } from "next/server";
import { AUDIT_ACTIONS, cancelRfq, logAuditSafe } from "@/lib/queries";
import { withAuth } from "@/lib/withAuth";
import { cancelRfqSchema, parseRequest } from "@/lib/validations";
import { deriveRoleFlags } from "@/lib/roles";
import { resolveRfqId } from "../../_helpers";

/**
 * POST /api/projects/[id]/rfqs/[rfqId]/cancel — PM only. Cancelling an
 * issued RFQ reverts every referenced BOQ item's `po_status` back to `none`
 * unless another live RFQ still references it.
 */
export const POST = withAuth(
  {
    projectAccess: true,
    blockedRoles: ["client", "vendor"],
    fetchOrgRole: true,
  },
  async (req, { user, orgId, orgRole, effectiveRole }, params) => {
    const { isPM } = deriveRoleFlags(orgRole, effectiveRole);
    if (!isPM) {
      return NextResponse.json(
        { error: "Only project managers can cancel RFQs" },
        { status: 403 }
      );
    }

    const resolved = await resolveRfqId(params.id, params.rfqId);
    if (!resolved.ok) return resolved.response;

    const parsed = await parseRequest(req, cancelRfqSchema);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    const result = await cancelRfq(resolved.rfqId);
    if (!result.ok) {
      if (result.reason === "not_found") {
        return NextResponse.json({ error: "RFQ not found" }, { status: 404 });
      }
      return NextResponse.json(
        { error: "RFQ cannot be cancelled in its current status" },
        { status: 409 }
      );
    }

    if (orgId) {
      void logAuditSafe({
        orgId,
        actorId: user.id,
        action: AUDIT_ACTIONS.RFQ_CANCELLED,
        targetTable: "rfq",
        targetId: resolved.rfqId,
        metadata: { reason: parsed.data.reason ?? null },
      });
    }
    return NextResponse.json(result.rfq);
  }
);
