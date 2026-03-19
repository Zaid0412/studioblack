import { NextResponse } from "next/server";
import { getPool } from "@/lib/db";
import { withAuth } from "@/lib/withAuth";

/** PATCH /api/tasks/[id]/checklist/reorder — bulk-update checklist item positions. */
export const PATCH = withAuth(
  { blockedRoles: ["client"] },
  async (req, _ctx, params) => {
    try {
      const pool = getPool();
      const taskId = params.id;

      const { rows: taskRows } = await pool.query(
        `SELECT id FROM task WHERE id = $1`,
        [taskId]
      );
      if (taskRows.length === 0) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
      }

      const body = await req.json();
      const orderedIds: string[] = body.orderedIds;
      if (!Array.isArray(orderedIds) || orderedIds.length === 0) {
        return NextResponse.json(
          { error: "orderedIds array is required" },
          { status: 400 }
        );
      }

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
      return NextResponse.json(
        { error: err instanceof Error ? err.message : "Failed to reorder" },
        { status: 500 }
      );
    }
  }
);
