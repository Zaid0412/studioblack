import { NextResponse } from "next/server";
import {
  AUDIT_ACTIONS,
  getScopeChangeById,
  logAuditSafe,
  updateScopeChange,
} from "@/lib/queries";
import { withAuth } from "@/lib/withAuth";
import { parseRequest, updateScopeChangeSchema } from "@/lib/validations";

/** GET /api/scope-changes/[id] — full detail row. */
export const GET = withAuth(
  { allowedRoles: ["pm", "architect"] },
  async (_req, { orgId }, params) => {
    if (!orgId) {
      return NextResponse.json({ error: "No organisation" }, { status: 400 });
    }
    const row = await getScopeChangeById(orgId, params.id);
    if (!row) {
      return NextResponse.json(
        { error: "Scope change not found" },
        { status: 404 }
      );
    }
    return NextResponse.json(row);
  }
);

/** PATCH /api/scope-changes/[id] — edit while still `requested`. */
export const PATCH = withAuth(
  { allowedRoles: ["pm", "architect"] },
  async (req, { orgId, user }, params) => {
    if (!orgId) {
      return NextResponse.json({ error: "No organisation" }, { status: 400 });
    }
    const parsed = await parseRequest(req, updateScopeChangeSchema);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    const result = await updateScopeChange(orgId, params.id, parsed.data);
    if (!result.ok) {
      if (result.reason === "not_found") {
        return NextResponse.json(
          { error: "Scope change not found" },
          { status: 404 }
        );
      }
      if (result.reason === "not_editable") {
        return NextResponse.json(
          { error: "Only a scope change in 'requested' can be edited" },
          { status: 409 }
        );
      }
      return NextResponse.json({ error: result.reason }, { status: 400 });
    }
    // Audit only a real write (no-op / all-ignored PATCH changes nothing).
    if (result.changedColumns.length > 0) {
      void logAuditSafe({
        orgId,
        actorId: user.id,
        action: AUDIT_ACTIONS.SCOPE_CHANGE_UPDATED,
        targetTable: "scope_change",
        targetId: params.id,
        metadata: { fields: result.changedColumns },
      });
    }
    return NextResponse.json(result.row);
  }
);
