import { NextResponse } from "next/server";
import { getPool } from "@/lib/db";
import { verifyTaskAccess } from "@/lib/queries";
import { parseBody, reorderChecklistSchema } from "@/lib/validations";
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

      const raw = await req.json();
      const parsed = parseBody(reorderChecklistSchema, raw);
      if (!parsed.success) {
        return NextResponse.json({ error: parsed.error }, { status: 400 });
      }
      const { orderedIds } = parsed.data;

      const pool = getPool();
      // Update positions in a single query using unnest
      await pool.query(
        `UPDATE task_checklist_item
         SET position = data.pos
         FROM (SELECT unnest($1::uuid[]) AS id, generate_series(0, $2::int) AS pos) data
         WHERE task_checklist_item.id = data.id AND task_checklist_item.task_id = $3`,
        [orderedIds, orderedIds.length - 1, taskId]
      );

      return NextResponse.json({ ok: true });
    } catch (err) {
      console.error("Checklist reorder error:", err);
      return NextResponse.json({ error: "Failed to reorder" }, { status: 500 });
    }
  }
);
