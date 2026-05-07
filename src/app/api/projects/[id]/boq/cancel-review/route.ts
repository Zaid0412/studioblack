import { NextResponse } from "next/server";
import { getBoqByProject, getBoq, cancelBoqReview } from "@/lib/queries";
import { withAuth } from "@/lib/withAuth";
import { logAuditSafe, AUDIT_ACTIONS } from "@/lib/queries/audit";

/**
 * POST /api/projects/[id]/boq/cancel-review — creator escape hatch.
 * Pulls a `pending_internal_review` BOQ back to `draft` so the creator
 * can keep editing without going through a reviewer round-trip.
 *
 * Only the BOQ creator may call this. Audit columns from the previous
 * submission stay populated so the timeline can show "submitted, then
 * cancelled".
 */
export const POST = withAuth(
  { blockedRoles: ["client"], projectAccess: true },
  async (_req, { user, orgId }, params) => {
    if (!orgId) {
      return NextResponse.json({ error: "No organisation" }, { status: 403 });
    }

    const header = await getBoqByProject(params.id);
    if (!header) {
      return NextResponse.json({ error: "BOQ not found" }, { status: 404 });
    }

    if (header.created_by !== user.id) {
      return NextResponse.json(
        { error: "Only the BOQ creator can cancel a review." },
        { status: 403 }
      );
    }

    if (header.status !== "pending_internal_review") {
      return NextResponse.json(
        {
          error: `Cannot cancel review for a BOQ in status "${header.status}".`,
          code: "INVALID_STATUS_TRANSITION",
        },
        { status: 422 }
      );
    }

    const updated = await cancelBoqReview(header.id);
    if (!updated) {
      return NextResponse.json({ error: "BOQ not found" }, { status: 404 });
    }

    logAuditSafe({
      orgId,
      actorId: user.id,
      action: AUDIT_ACTIONS.BOQ_REVIEW_CANCELLED,
      targetTable: "boq",
      targetId: header.id,
      metadata: { project_id: params.id, boq_title: header.title },
    });

    const full = await getBoq(header.id);
    return NextResponse.json(full);
  }
);
