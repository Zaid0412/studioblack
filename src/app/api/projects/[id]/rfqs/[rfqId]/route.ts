import { NextResponse } from "next/server";
import {
  AUDIT_ACTIONS,
  getRfqDetail,
  logAuditSafe,
  updateRfqDraft,
} from "@/lib/queries";
import { withAuth } from "@/lib/withAuth";
import { parseRequest, updateRfqSchema } from "@/lib/validations";
import { resolveRfqId } from "../_helpers";

/** GET /api/projects/[id]/rfqs/[rfqId] — full RFQ detail. */
export const GET = withAuth(
  { projectAccess: true, blockedRoles: ["client", "vendor"] },
  async (_req, _ctx, params) => {
    const resolved = await resolveRfqId(params.id, params.rfqId);
    if (!resolved.ok) return resolved.response;

    const detail = await getRfqDetail(resolved.rfqId);
    if (!detail) {
      return NextResponse.json({ error: "RFQ not found" }, { status: 404 });
    }
    return NextResponse.json(detail);
  }
);

/**
 * PATCH /api/projects/[id]/rfqs/[rfqId] — header-only edit while in draft.
 * Returns 409 once the RFQ has been issued — rewriting the scope after
 * vendors have seen it would silently change what they were asked to bid on.
 */
export const PATCH = withAuth(
  { projectAccess: true, blockedRoles: ["client", "vendor"] },
  async (req, { user, orgId }, params) => {
    const resolved = await resolveRfqId(params.id, params.rfqId);
    if (!resolved.ok) return resolved.response;

    const parsed = await parseRequest(req, updateRfqSchema);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    const result = await updateRfqDraft(resolved.rfqId, parsed.data);
    if (!result.ok) {
      if (result.reason === "not_found") {
        return NextResponse.json({ error: "RFQ not found" }, { status: 404 });
      }
      if (result.reason === "wrong_status") {
        return NextResponse.json(
          { error: "RFQ has already been issued and can no longer be edited" },
          { status: 409 }
        );
      }
      return NextResponse.json(
        { error: "No fields to update" },
        { status: 400 }
      );
    }

    if (orgId) {
      void logAuditSafe({
        orgId,
        actorId: user.id,
        action: AUDIT_ACTIONS.RFQ_UPDATED,
        targetTable: "rfq",
        targetId: resolved.rfqId,
        metadata: { fields: Object.keys(parsed.data) },
      });
    }
    return NextResponse.json(result.row);
  }
);
