import { NextResponse } from "next/server";
import { getChecklistItems, createChecklistItem } from "@/lib/queries";
import { parseRequest, createChecklistItemSchema } from "@/lib/validations";
import { withAuth } from "@/lib/withAuth";
import { logger } from "@/lib/logger";
import { guardTaskAccess } from "../../helpers";

/** GET /api/tasks/[id]/checklist — list checklist items for a task. */
export const GET = withAuth(
  { blockedRoles: ["client"] },
  async (_req, { orgId }, params) => {
    const taskId = params.id;
    const guard = await guardTaskAccess(taskId, orgId);
    if (guard instanceof NextResponse) return guard;

    const rows = await getChecklistItems(taskId);
    return NextResponse.json(rows);
  }
);

/** POST /api/tasks/[id]/checklist — add a checklist item. */
export const POST = withAuth(
  { blockedRoles: ["client"] },
  async (req, { orgId }, params) => {
    try {
      const taskId = params.id;
      const guard = await guardTaskAccess(taskId, orgId);
      if (guard instanceof NextResponse) return guard;

      const parsed = await parseRequest(req, createChecklistItemSchema);
      if (!parsed.success) {
        return NextResponse.json({ error: parsed.error }, { status: 400 });
      }
      const { title } = parsed.data;

      const item = await createChecklistItem(taskId, title);
      return NextResponse.json(item, { status: 201 });
    } catch (err) {
      logger.error("Checklist POST error", { taskId: params.id, error: err });
      return NextResponse.json(
        { error: "Failed to create item" },
        { status: 500 }
      );
    }
  }
);
