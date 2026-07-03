import { NextResponse } from "next/server";
import {
  AUDIT_ACTIONS,
  syncRfqItemsFromBoq,
  logAuditSafe,
} from "@/lib/queries";
import { withAuth } from "@/lib/withAuth";
import { resolveRfqId } from "../../_helpers";

/**
 * POST /api/projects/[id]/rfqs/[rfqId]/sync-boq — pm/architect (RFQ-3c).
 * Pulls current BOQ quantities into the live RFQ's items (reuse the vendor
 * rate). Quantity only; spec changes route to a revision. Refused unless the
 * RFQ is in-flight (issued / quotes_received / under_review).
 */
export const POST = withAuth(
  { projectAccess: true, blockedRoles: ["client", "vendor"] },
  async (_req, { user, orgId }, params) => {
    const resolved = await resolveRfqId(params.id, params.rfqId);
    if (!resolved.ok) return resolved.response;

    const result = await syncRfqItemsFromBoq(resolved.rfqId);
    if (!result.ok) {
      if (result.reason === "not_found") {
        return NextResponse.json({ error: "RFQ not found" }, { status: 404 });
      }
      return NextResponse.json(
        { error: "This RFQ is not in a state that can sync from the BOQ" },
        { status: 409 }
      );
    }

    if (orgId && result.synced > 0) {
      void logAuditSafe({
        orgId,
        actorId: user.id,
        action: AUDIT_ACTIONS.RFQ_SYNCED_FROM_BOQ,
        targetTable: "rfq",
        targetId: resolved.rfqId,
        metadata: { synced: result.synced },
      });
    }
    return NextResponse.json({ synced: result.synced });
  }
);
