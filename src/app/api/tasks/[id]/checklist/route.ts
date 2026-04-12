import { NextResponse } from "next/server";
import {
  verifyTaskAccess,
  getChecklistItems,
  createChecklistItem,
} from "@/lib/queries";
import { parseRequest, createChecklistItemSchema } from "@/lib/validations";
import { withAuth } from "@/lib/withAuth";
import { logger } from "@/lib/logger";

/** GET /api/tasks/[id]/checklist — list checklist items for a task. */
export const GET = withAuth(
  { blockedRoles: ["client"] },
  async (_req, { orgId }, params) => {
    const taskId = params.id;
    if (!(await verifyTaskAccess(taskId, orgId))) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

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
      if (!(await verifyTaskAccess(taskId, orgId))) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
      }

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
