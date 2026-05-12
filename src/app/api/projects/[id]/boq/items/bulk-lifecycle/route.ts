import { NextResponse } from "next/server";
import {
  setBoqItemsPhase,
  getBoq,
  getEligibleReviewers,
  getProjectClientInfo,
} from "@/lib/queries";
import { withAuth } from "@/lib/withAuth";
import { setItemsPhaseSchema } from "@/lib/validations";
import { logAuditSafe, AUDIT_ACTIONS } from "@/lib/queries/audit";
import {
  createNotification,
  notifyUserByEmail,
} from "@/lib/notifications";
import { sendNotificationEmail, escapeHtml } from "@/lib/email";
import { logger } from "@/lib/logger";
import { parseBoqRequest, canFirePhaseTransition } from "../../_helpers";

/**
 * POST /api/projects/[id]/boq/items/bulk-lifecycle
 *
 * Body: `{ boqId, itemIds, phase, comment? }`. Applies the same target
 * phase to every listed item in a single transaction; on failure the
 * whole batch rolls back. Same permission rules as the single-item
 * variant (see `canFirePhaseTransition`).
 *
 * Notification fan-out is batched **by recipient** — a creator with 5
 * affected items gets one email summarising all 5, not five emails.
 */
export const POST = withAuth(
  { projectAccess: true, fetchOrgRole: true },
  async (req, { user, orgId, orgRole, effectiveRole }, params) => {
    const result = await parseBoqRequest(req, params.id, setItemsPhaseSchema);
    if (!result.ok) return result.response;

    const { itemIds, phase: target, comment } = result.data;
    const boq = await getBoq(result.boqId);
    if (!boq) {
      return NextResponse.json({ error: "BOQ not found" }, { status: 404 });
    }

    const isPM = orgRole === "owner" || orgRole === "admin";
    const isClient = effectiveRole === "client";
    if (
      !canFirePhaseTransition({
        target,
        actorId: user.id,
        isPM,
        isClient,
        boqCreatorId: boq.created_by,
      })
    ) {
      return NextResponse.json(
        { error: "You are not allowed to make this phase change." },
        { status: 403 }
      );
    }

    const outcome = await setBoqItemsPhase(itemIds, result.boqId, target);
    if (!outcome.ok && outcome.reason === "wrong_boq") {
      return NextResponse.json(
        { error: "One or more items were not found in this BOQ." },
        { status: 404 }
      );
    }
    if (!outcome.ok && outcome.reason === "invalid_transition") {
      return NextResponse.json(
        {
          error: `One or more items can't move to "${target}" from their current phase.`,
          code: "INVALID_PHASE_TRANSITION" as const,
          blockedIds: outcome.blockedIds,
        },
        { status: 422 }
      );
    }
    if (!outcome.ok) {
      return NextResponse.json({ error: "Update failed" }, { status: 500 });
    }

    if (orgId) {
      logAuditSafe({
        orgId,
        actorId: user.id,
        action: AUDIT_ACTIONS.BOQ_ITEM_PHASE_CHANGED,
        targetTable: "boq",
        targetId: result.boqId,
        metadata: {
          project_id: params.id,
          boq_id: result.boqId,
          to: target,
          item_count: itemIds.length,
          item_ids: itemIds,
          comment: comment ?? null,
        },
      });
    }

    fanOutBulkNotifications({
      projectId: params.id,
      orgId,
      boqTitle: boq.title,
      boqCreatorId: boq.created_by,
      target,
      itemCount: itemIds.length,
      actor: user,
      comment: comment ?? null,
    }).catch((err) =>
      logger.warn("Bulk phase notification fan-out failed", { error: err })
    );

    return NextResponse.json({ items: outcome.items });
  }
);

/**
 * One notification per affected recipient — never one per item.
 *
 * Recipients depend on the target phase, mirroring the single-item route's
 * rules but worded for batches ("3 items" vs "this item").
 */
async function fanOutBulkNotifications(opts: {
  projectId: string;
  orgId: string | null;
  boqTitle: string;
  boqCreatorId: string | null;
  target: string;
  itemCount: number;
  actor: { id: string; name?: string | null; email?: string | null };
  comment: string | null;
}) {
  const {
    projectId,
    orgId,
    boqTitle,
    boqCreatorId,
    target,
    itemCount,
    actor,
    comment,
  } = opts;
  const actorName = actor.name || actor.email || "A teammate";
  const noun = itemCount === 1 ? "item" : `${itemCount} items`;
  const title = (() => {
    switch (target) {
      case "internal_review":
        return `BOQ ${noun} submitted for review: ${boqTitle}`;
      case "internally_approved":
        return `BOQ ${noun} internally approved: ${boqTitle}`;
      case "submitted_to_client":
        return `BOQ ${noun} sent to client: ${boqTitle}`;
      case "client_approved":
        return `BOQ ${noun} approved by client: ${boqTitle}`;
      case "change_requested":
        return `BOQ ${noun} — changes requested: ${boqTitle}`;
      default:
        return `BOQ ${noun} moved to ${target}`;
    }
  })();
  const desc = comment
    ? `${actorName} — ${comment}`
    : `${actorName} updated ${noun} to ${target.replace(/_/g, " ")}.`;

  switch (target) {
    case "internal_review": {
      if (!orgId) return;
      const reviewers = await getEligibleReviewers({
        orgId,
        creatorId: actor.id,
      });
      for (const userId of reviewers) {
        createNotification({
          userId,
          type: "boq_item_review_requested",
          title,
          description: desc,
          projectId,
        }).catch(() => {});
        notifyUserByEmail(userId, title, desc);
      }
      return;
    }
    case "internally_approved":
    case "client_approved":
    case "change_requested": {
      if (boqCreatorId && boqCreatorId !== actor.id) {
        createNotification({
          userId: boqCreatorId,
          type: `boq_item_${target}`,
          title,
          description: desc,
          projectId,
        }).catch(() => {});
        notifyUserByEmail(boqCreatorId, title, desc);
      }
      return;
    }
    case "submitted_to_client": {
      const client = await getProjectClientInfo(projectId);
      if (client?.client_email) {
        sendNotificationEmail(
          client.client_email,
          title,
          `<p>${escapeHtml(actorName)} sent ${escapeHtml(noun)} on <strong>${escapeHtml(boqTitle)}</strong> for your review.</p>${
            comment
              ? `<p style="color: #666;">${escapeHtml(comment)}</p>`
              : ""
          }`
        ).catch((err) =>
          logger.error("Client bulk email failed", { error: err })
        );
      }
      return;
    }
    default:
      return;
  }
}
