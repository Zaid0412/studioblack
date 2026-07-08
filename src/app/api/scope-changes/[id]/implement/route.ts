import { NextResponse } from "next/server";
import {
  AUDIT_ACTIONS,
  implementScopeChange,
  logAuditSafe,
} from "@/lib/queries";
import { withAuth } from "@/lib/withAuth";

/** Map a query-layer failure reason to an HTTP status + message. */
const REASON_MAP: Record<string, [number, string]> = {
  not_found: [404, "Scope change not found"],
  invalid_status_transition: [
    409,
    "Only an approved scope change can be implemented",
  ],
};

/** POST /api/scope-changes/[id]/implement — execute the approved change. */
export const POST = withAuth(
  { allowedRoles: ["pm", "architect"] },
  async (_req, { orgId, user }, params) => {
    if (!orgId) {
      return NextResponse.json({ error: "No organisation" }, { status: 400 });
    }
    const result = await implementScopeChange(orgId, params.id, {
      userId: user.id,
    });
    if (!result.ok) {
      const [status, error] = REASON_MAP[result.reason] ?? [400, result.reason];
      return NextResponse.json({ error }, { status });
    }
    void logAuditSafe({
      orgId,
      actorId: user.id,
      action: AUDIT_ACTIONS.SCOPE_CHANGE_IMPLEMENTED,
      targetTable: "scope_change",
      targetId: params.id,
      metadata: {
        impact: result.row.impact,
        boq_item_version_id: result.row.boq_item_version_id,
        rfq_id: result.row.rfq_id,
      },
    });
    return NextResponse.json(result.row);
  }
);
