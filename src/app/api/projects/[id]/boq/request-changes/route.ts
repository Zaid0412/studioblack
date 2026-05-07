import { NextResponse } from "next/server";
import {
  getBoqByProject,
  getBoq,
  requestBoqChanges,
  getEligibleReviewers,
} from "@/lib/queries";
import { withAuth } from "@/lib/withAuth";
import { createNotification, notifyUserByEmail } from "@/lib/notifications";
import { parseRequest, requestBoqChangesSchema } from "@/lib/validations";
import { logAuditSafe, AUDIT_ACTIONS } from "@/lib/queries/audit";
import { logger } from "@/lib/logger";

/**
 * POST /api/projects/[id]/boq/request-changes — flip
 * `pending_internal_review` into `changes_requested` with a required
 * comment that surfaces in the creator's banner.
 *
 * Eligibility matches /approve: PM or architect on the project, NOT the
 * BOQ creator. Comment must be present (≥ 1 char after trim) and ≤ 2000
 * chars — otherwise the creator gets bounced with no signal.
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
          error: `Cannot request changes on a BOQ in status "${header.status}".`,
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
        { error: "You are not eligible to review this BOQ." },
        { status: 403 }
      );
    }

    const parsed = await parseRequest(req, requestBoqChangesSchema);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    const updated = await requestBoqChanges({
      boqId: header.id,
      requestedBy: user.id,
      comment: parsed.data.comment,
    });
    if (!updated) {
      return NextResponse.json({ error: "BOQ not found" }, { status: 404 });
    }

    logAuditSafe({
      orgId,
      actorId: user.id,
      action: AUDIT_ACTIONS.BOQ_CHANGES_REQUESTED,
      targetTable: "boq",
      targetId: header.id,
      metadata: {
        project_id: params.id,
        boq_title: header.title,
        comment: parsed.data.comment,
      },
    });

    if (header.created_by && header.created_by !== user.id) {
      const title = `Changes requested on BOQ: ${header.title}`;
      const description = `${user.name || "A reviewer"} asked you to make changes before the BOQ goes to the client.`;
      createNotification({
        userId: header.created_by,
        type: "boq_changes_requested",
        title,
        description,
        projectId: params.id,
      }).catch((err) =>
        logger.warn("BOQ changes-requested notification failed", { error: err })
      );
      notifyUserByEmail(header.created_by, title, description);
    }

    const full = await getBoq(header.id);
    return NextResponse.json(full);
  }
);
