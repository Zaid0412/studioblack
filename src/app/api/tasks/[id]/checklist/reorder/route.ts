import { NextResponse } from "next/server";
import { verifyTaskAccess, reorderChecklistItems } from "@/lib/queries";
import { parseRequest, reorderChecklistSchema } from "@/lib/validations";
import { withAuth } from "@/lib/withAuth";

/** PATCH /api/tasks/[id]/checklist/reorder — bulk-update checklist item positions. */
export const PATCH = withAuth(
  { blockedRoles: ["client"] },
  async (req, { orgId }, params) => {
    try {
      const taskId = params.id;
      if (!(await verifyTaskAccess(taskId, orgId))) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
      }

      const parsed = await parseRequest(req, reorderChecklistSchema);
      if (!parsed.success) {
        return NextResponse.json({ error: parsed.error }, { status: 400 });
      }
      const { orderedIds } = parsed.data;

      await reorderChecklistItems(taskId, orderedIds);

      return NextResponse.json({ ok: true });
    } catch (err) {
      console.error("Checklist reorder error:", err);
      return NextResponse.json({ error: "Failed to reorder" }, { status: 500 });
    }
  }
);
