import { NextResponse } from "next/server";
import {
  AUDIT_ACTIONS,
  createScopeChange,
  listScopeChanges,
  logAuditSafe,
} from "@/lib/queries";
import { withAuth } from "@/lib/withAuth";
import {
  parseRequest,
  createScopeChangeSchema,
  listScopeChangesQuerySchema,
} from "@/lib/validations";

/** GET /api/scope-changes — paginated list with filters. */
export const GET = withAuth(
  { allowedRoles: ["pm", "architect"] },
  async (req, { orgId }) => {
    if (!orgId) {
      return NextResponse.json({ rows: [], total: 0 });
    }
    const raw = Object.fromEntries(req.nextUrl.searchParams);
    const parsed = listScopeChangesQuerySchema.safeParse(raw);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      const path = issue.path.length > 0 ? `${issue.path.join(".")}: ` : "";
      return NextResponse.json(
        { error: `${path}${issue.message}` },
        { status: 400 }
      );
    }
    const { rows, total } = await listScopeChanges(orgId, parsed.data);
    return NextResponse.json({
      rows,
      total,
      page: parsed.data.page,
      limit: parsed.data.limit,
    });
  }
);

/** POST /api/scope-changes — raise a scope change against a BOQ item. */
export const POST = withAuth(
  { allowedRoles: ["pm", "architect"] },
  async (req, { orgId, user }) => {
    if (!orgId) {
      return NextResponse.json({ error: "No organisation" }, { status: 400 });
    }
    const parsed = await parseRequest(req, createScopeChangeSchema);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    const result = await createScopeChange(orgId, user.id, parsed.data);
    if (!result.ok) {
      const status = result.reason === "boq_item_not_found" ? 404 : 400;
      return NextResponse.json({ error: result.reason }, { status });
    }
    void logAuditSafe({
      orgId,
      actorId: user.id,
      action: AUDIT_ACTIONS.SCOPE_CHANGE_CREATED,
      targetTable: "scope_change",
      targetId: result.row.id,
      metadata: {
        sc_number: result.row.sc_number,
        boq_item_id: result.row.boq_item_id,
        impact: result.row.impact,
      },
    });
    return NextResponse.json(result.row, { status: 201 });
  }
);
