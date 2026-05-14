import { NextResponse } from "next/server";
import { setBoqItemsPhase, getBoq } from "@/lib/queries";
import { withAuth } from "@/lib/withAuth";
import { setItemsPhaseSchema } from "@/lib/validations";
import { logAuditSafe, AUDIT_ACTIONS } from "@/lib/queries/audit";
import { logger } from "@/lib/logger";
import { parseBoqRequest, canFirePhaseTransition } from "../../_helpers";
import { notifyPhaseRecipients } from "../../_phaseNotifications";

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
  {
    projectAccess: true,
    fetchOrgRole: true,
    // `submitted_to_client` fans out an email per affected item; cap the
    // blast radius if an insider fires the route in a loop.
    rateLimit: { limit: 10, windowMs: 60_000 },
  },
  async (req, { user, orgId, orgRole, effectiveRole }, params) => {
    const result = await parseBoqRequest(req, params.id, setItemsPhaseSchema);
    if (!result.ok) return result.response;

    const { itemIds, phase: target, comment } = result.data;
    const boq = await getBoq(result.boqId);
    if (!boq) {
      return NextResponse.json({ error: "BOQ not found" }, { status: 404 });
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
      // Convention: bulk transitions log ONE summary row against the BOQ
      // (target_table = "boq"), with the affected item_ids in metadata.
      // Per-item history is reconstructed by scanning metadata.item_ids —
      // avoids logging N rows for a single user action. Single-item
      // transitions still log against target_table = "boq_item".
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

    notifyPhaseRecipients({
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
