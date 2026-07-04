import { NextResponse } from "next/server";
import {
  AUDIT_ACTIONS,
  createRfqDraft,
  getRfqsByProject,
  logAuditSafe,
} from "@/lib/queries";
import { withAuth } from "@/lib/withAuth";
import {
  createRfqSchema,
  listRfqsQuerySchema,
  parseRequest,
} from "@/lib/validations";

/** GET /api/projects/[id]/rfqs — paginated RFQ list for the project. */
export const GET = withAuth(
  { projectAccess: true, blockedRoles: ["client", "vendor"] },
  async (req, _ctx, params) => {
    const raw = Object.fromEntries(req.nextUrl.searchParams);
    const parsed = listRfqsQuerySchema.safeParse(raw);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      const path = issue.path.length > 0 ? `${issue.path.join(".")}: ` : "";
      return NextResponse.json(
        { error: `${path}${issue.message}` },
        { status: 400 }
      );
    }
    const result = await getRfqsByProject(params.id, parsed.data);
    return NextResponse.json({
      rows: result.rows,
      total: result.total,
      readyNotInRfq: result.readyNotInRfq,
      page: parsed.data.page,
      limit: parsed.data.limit,
    });
  }
);

/** POST /api/projects/[id]/rfqs — create an RFQ draft + items. */
export const POST = withAuth(
  { projectAccess: true, blockedRoles: ["client", "vendor"] },
  async (req, { user, orgId }, params) => {
    const parsed = await parseRequest(req, createRfqSchema);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    try {
      const rfq = await createRfqDraft(params.id, user.id, parsed.data);
      if (orgId) {
        void logAuditSafe({
          orgId,
          actorId: user.id,
          action: AUDIT_ACTIONS.RFQ_CREATED,
          targetTable: "rfq",
          targetId: rfq.id,
          metadata: {
            project_id: params.id,
            rfq_number: rfq.rfq_number,
            item_count: parsed.data.items.length,
          },
        });
      }
      return NextResponse.json(rfq, { status: 201 });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to create RFQ";
      const status = /not belong/.test(message)
        ? 400
        : /project not found/i.test(message)
          ? 404
          : 400;
      return NextResponse.json({ error: message }, { status });
    }
  }
);
