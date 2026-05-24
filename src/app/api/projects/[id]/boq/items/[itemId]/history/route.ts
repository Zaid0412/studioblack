import { NextResponse } from "next/server";
import {
  getBoqItemContext,
  getBoqItemHistory,
  CLIENT_VISIBLE_PHASES,
} from "@/lib/queries";
import { withAuth } from "@/lib/withAuth";
import { isExternalViewer } from "@/lib/roles";
import type { BoqItemPhase } from "@/lib/validations";
import type { BoqItemHistoryEvent } from "@/types";

const clientVisible = new Set<BoqItemPhase>(CLIENT_VISIBLE_PHASES);

/**
 * GET /api/projects/[id]/boq/items/[itemId]/history
 *
 * Per-item phase-change timeline rendered by the Activity tab in
 * `BoqItemDrawer`. External viewers (client, vendor) get the studio-side
 * churn scrubbed — only transitions that touch a client-visible phase
 * remain.
 */
export const GET = withAuth(
  { projectAccess: true, fetchOrgRole: true },
  async (_req, { effectiveRole }, params) => {
    const { id: projectId, itemId } = params;

    const ctx = await getBoqItemContext(itemId, projectId);
    if (!ctx) {
      return NextResponse.json(
        { error: "Item not found in this project" },
        { status: 404 }
      );
    }

    const events = await getBoqItemHistory(itemId, ctx.boqId, ctx.orgId);

    const visible = isExternalViewer(effectiveRole)
      ? events.filter(
          (e) =>
            (e.from_phase !== null && clientVisible.has(e.from_phase)) ||
            clientVisible.has(e.to_phase)
        )
      : events;

    return NextResponse.json({
      events: visible satisfies BoqItemHistoryEvent[],
    });
  }
);
