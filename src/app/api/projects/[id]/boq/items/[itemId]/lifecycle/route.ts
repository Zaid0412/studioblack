import { NextResponse } from "next/server";
import { getBoqItemContext, setBoqItemPhase } from "@/lib/queries";
import { withAuth } from "@/lib/withAuth";
import { parseRequest, setItemPhaseSchema } from "@/lib/validations";
import { logAuditSafe, AUDIT_ACTIONS } from "@/lib/queries/audit";
import { logger } from "@/lib/logger";
import { canFirePhaseTransition } from "../../../_helpers";
import { notifyPhaseRecipients } from "../../../_phaseNotifications";

/**
 * POST /api/projects/[id]/boq/items/[itemId]/lifecycle
 *
 * Move a single BOQ item to a new phase. Permissions are gated per Pap's
 * 2026-05-12 spec via `canFirePhaseTransition`. On success: audit + the
 * appropriate notification(s) for the target phase.
 */
export const POST = withAuth(
  { projectAccess: true, fetchOrgRole: true },
  async (req, { user, orgRole, effectiveRole }, params) => {
    const { id: projectId, itemId } = params;

    const parsed = await parseRequest(req, setItemPhaseSchema);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }
    const { phase: target, comment } = parsed.data;

    const ctx = await getBoqItemContext(itemId, projectId);
    if (!ctx) {
      return NextResponse.json(
        { error: "Item not found in this project" },
        { status: 404 }
      );
    }

    const isPM = orgRole === "owner" || orgRole === "admin";
    const isArchitect = orgRole === "member";
    const isClient = effectiveRole === "client";
    if (
      !canFirePhaseTransition({
        target,
        actorId: user.id,
        isPM,
        isArchitect,
        isClient,
        boqCreatorId: ctx.boqCreatorId,
      })
    ) {
      return NextResponse.json(
        { error: "You are not allowed to make this phase change." },
        { status: 403 }
      );
    }

    const outcome = await setBoqItemPhase(itemId, target);
    if (!outcome.ok && outcome.reason === "not_found") {
      return NextResponse.json({ error: "Item not found" }, { status: 404 });
    }
    if (!outcome.ok && outcome.reason === "invalid_transition") {
      return NextResponse.json(
        {
          error: `Cannot move from "${outcome.from}" to "${target}".`,
          code: "INVALID_PHASE_TRANSITION" as const,
        },
        { status: 422 }
      );
    }
    if (!outcome.ok) {
      return NextResponse.json({ error: "Update failed" }, { status: 500 });
    }
    const item = outcome.item;

    logAuditSafe({
      orgId: ctx.orgId,
      actorId: user.id,
      action: AUDIT_ACTIONS.BOQ_ITEM_PHASE_CHANGED,
      targetTable: "boq_item",
      targetId: itemId,
      metadata: {
        project_id: projectId,
        boq_id: ctx.boqId,
        from: ctx.phase,
        to: target,
        comment: comment ?? null,
      },
    });

    notifyPhaseRecipients({
      projectId,
      orgId: ctx.orgId,
      boqTitle: ctx.boqTitle,
      boqCreatorId: ctx.boqCreatorId,
      target,
      itemIds: [itemId],
      actor: user,
      comment: comment ?? null,
    }).catch((err) =>
      logger.warn("Phase notification fan-out failed", { error: err })
    );

    return NextResponse.json(item);
  }
);
