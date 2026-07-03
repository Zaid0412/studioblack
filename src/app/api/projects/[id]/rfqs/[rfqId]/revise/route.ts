import { NextResponse } from "next/server";
import { AUDIT_ACTIONS, cloneRfqAsRevision, logAuditSafe } from "@/lib/queries";
import { withAuth } from "@/lib/withAuth";
import { reviseRfqSchema, parseRequest } from "@/lib/validations";
import { resolveRfqId } from "../../_helpers";

/**
 * POST /api/projects/[id]/rfqs/[rfqId]/revise — pm/architect. Raises a revision
 * (RFQ-3b): clones the RFQ into a new draft that supersedes it, and returns the
 * new draft so the client can navigate straight to it. Refused unless the RFQ is
 * in a revisable status (issued / quotes_received / under_review / awarded).
 */
export const POST = withAuth(
  {
    projectAccess: true,
    blockedRoles: ["client", "vendor"],
  },
  async (req, { user, orgId }, params) => {
    const resolved = await resolveRfqId(params.id, params.rfqId);
    if (!resolved.ok) return resolved.response;

    const parsed = await parseRequest(req, reviseRfqSchema);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    const result = await cloneRfqAsRevision(resolved.rfqId, user.id);
    if (!result.ok) {
      if (result.reason === "not_found") {
        return NextResponse.json({ error: "RFQ not found" }, { status: 404 });
      }
      return NextResponse.json(
        { error: "This RFQ cannot be revised in its current status" },
        { status: 409 }
      );
    }

    if (orgId) {
      void logAuditSafe({
        orgId,
        actorId: user.id,
        action: AUDIT_ACTIONS.RFQ_REVISED,
        targetTable: "rfq",
        targetId: result.rfq.id,
        metadata: {
          supersedes_rfq_id: resolved.rfqId,
          revision_number: result.rfq.revision_number,
          reason: parsed.data.reason ?? null,
        },
      });
    }
    return NextResponse.json(result.rfq);
  }
);
