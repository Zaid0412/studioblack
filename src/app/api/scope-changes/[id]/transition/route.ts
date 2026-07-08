import { NextResponse } from "next/server";
import {
  AUDIT_ACTIONS,
  logAuditSafe,
  transitionScopeChange,
} from "@/lib/queries";
import { withAuth } from "@/lib/withAuth";
import { parseRequest, transitionScopeChangeSchema } from "@/lib/validations";

/** Map a query-layer failure reason to an HTTP status + message. */
const REASON_MAP: Record<string, [number, string]> = {
  not_found: [404, "Scope change not found"],
  forbidden: [403, "You don't have permission for this action"],
  invalid_status_transition: [
    409,
    "That action isn't allowed from the current status",
  ],
};

/** POST /api/scope-changes/[id]/transition — advance the lifecycle. */
export const POST = withAuth(
  { allowedRoles: ["pm", "architect"] },
  async (req, { orgId, user, effectiveRole }, params) => {
    if (!orgId) {
      return NextResponse.json({ error: "No organisation" }, { status: 400 });
    }
    const parsed = await parseRequest(req, transitionScopeChangeSchema);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    const result = await transitionScopeChange(
      orgId,
      params.id,
      parsed.data.action,
      { userId: user.id, role: effectiveRole },
      parsed.data.note
    );
    if (!result.ok) {
      const [status, error] = REASON_MAP[result.reason] ?? [400, result.reason];
      return NextResponse.json({ error }, { status });
    }
    void logAuditSafe({
      orgId,
      actorId: user.id,
      action: AUDIT_ACTIONS.SCOPE_CHANGE_TRANSITIONED,
      targetTable: "scope_change",
      targetId: params.id,
      metadata: { action: parsed.data.action, status: result.row.status },
    });
    return NextResponse.json(result.row);
  }
);
