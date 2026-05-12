import { NextResponse } from "next/server";
import {
  getBoqByProject,
  getBoq,
  approveBoqInternally,
  getEligibleReviewers,
} from "@/lib/queries";
import { withAuth } from "@/lib/withAuth";
import { createNotification, notifyUserByEmail } from "@/lib/notifications";
import { parseRequest, approveBoqSchema } from "@/lib/validations";
import { logAuditSafe, AUDIT_ACTIONS } from "@/lib/queries/audit";
import { logger } from "@/lib/logger";

/**
 * POST /api/projects/[id]/boq/approve — flip `pending_internal_review`
 * into `internally_approved`. The "Send to client" button unlocks once
 * this lands.
 *
 * Eligibility: PM (org owner/admin) or architect on the project, AND
 * NOT the BOQ creator. Comment is optional.
 */
export const POST = withAuth(
  { blockedRoles: ["client"], projectAccess: true },
  async (req, { user, orgId }, params) => {
    if (!orgId) {
      return NextResponse.json({ error: "No organisation" }, { status: 403 });
    }

    const header = await getBoqByProject(params.id);
    if (!header) {
      return NextResponse.json({ error: "BOQ not found" }, { status: 404 });
    }

    if (header.status !== "pending_internal_review") {
      return NextResponse.json(
        {
          error: `Cannot approve a BOQ in status "${header.status}".`,
          code: "INVALID_STATUS_TRANSITION",
        },
        { status: 422 }
      );
    }

    const eligible = await getEligibleReviewers({
      orgId,
      creatorId: header.created_by,
    });
    if (!eligible.includes(user.id)) {
      return NextResponse.json(
        { error: "You are not eligible to approve this BOQ." },
        { status: 403 }
      );
    }

    const parsed = await parseRequest(req, approveBoqSchema);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    const updated = await approveBoqInternally({
      boqId: header.id,
      approvedBy: user.id,
    });
    if (!updated) {
      return NextResponse.json({ error: "BOQ not found" }, { status: 404 });
    }

    logAuditSafe({
      orgId,
      actorId: user.id,
      action: AUDIT_ACTIONS.BOQ_INTERNALLY_APPROVED,
      targetTable: "boq",
      targetId: header.id,
      metadata: {
        project_id: params.id,
        boq_title: header.title,
        comment: parsed.data.comment ?? null,
      },
    });

    if (header.created_by && header.created_by !== user.id) {
      const title = `BOQ approved: ${header.title}`;
      const description = `${user.name || "A reviewer"} approved your BOQ for the client.`;
      createNotification({
        userId: header.created_by,
        type: "boq_internally_approved",
        title,
        description,
        projectId: params.id,
      }).catch((err) =>
        logger.warn("BOQ approval notification failed", { error: err })
      );
      notifyUserByEmail(header.created_by, title, description);
    }

    const full = await getBoq(header.id);
    return NextResponse.json(full);
  }
);
