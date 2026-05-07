import { NextResponse } from "next/server";
import {
  getBoqByProject,
  getBoq,
  submitBoqForReview,
  getEligibleReviewers,
} from "@/lib/queries";
import { withAuth } from "@/lib/withAuth";
import { createNotification, notifyUserByEmail } from "@/lib/notifications";
import { logAuditSafe, AUDIT_ACTIONS } from "@/lib/queries/audit";
import { logger } from "@/lib/logger";

/**
 * POST /api/projects/[id]/boq/submit-for-review — flip a `draft` (or
 * `changes_requested`) BOQ into `pending_internal_review` and notify
 * eligible reviewers.
 *
 * Only the BOQ creator may call this. Status must be `draft` or
 * `changes_requested`.
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
        { error: "Only the BOQ creator can submit for review." },
        { status: 403 }
      );
    }

    if (header.status !== "draft" && header.status !== "changes_requested") {
      return NextResponse.json(
        {
          error: `Cannot submit a BOQ in status "${header.status}" for review.`,
          code: "INVALID_STATUS_TRANSITION",
        },
        { status: 422 }
      );
    }

    const updated = await submitBoqForReview({
      boqId: header.id,
      submittedBy: user.id,
    });
    if (!updated) {
      return NextResponse.json({ error: "BOQ not found" }, { status: 404 });
    }

    // Audit + notify reviewers, fire-and-forget so a failure here doesn't
    // undo the status flip that already succeeded.
    logAuditSafe({
      orgId,
      actorId: user.id,
      action: AUDIT_ACTIONS.BOQ_SUBMITTED_FOR_REVIEW,
      targetTable: "boq",
      targetId: header.id,
      metadata: { project_id: params.id, boq_title: header.title },
    });

    getEligibleReviewers({ orgId, creatorId: user.id })
      .then((reviewerIds) => {
        const projectId = params.id;
        const title = `BOQ ready for review: ${header.title}`;
        const description = `${user.name || "An architect"} submitted a BOQ for your review.`;
        for (const userId of reviewerIds) {
          createNotification({
            userId,
            type: "boq_review_requested",
            title,
            description,
            projectId,
          }).catch((err) =>
            logger.warn("BOQ review notification failed", {
              userId,
              error: err,
            })
          );
          notifyUserByEmail(userId, title, description);
        }
      })
      .catch((err) =>
        logger.warn("BOQ review reviewer fan-out failed", { error: err })
      );

    const full = await getBoq(header.id);
    return NextResponse.json(full);
  }
);
