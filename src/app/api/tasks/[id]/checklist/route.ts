import { NextResponse } from "next/server";
import { getPool } from "@/lib/db";
import { withAuth } from "@/lib/withAuth";

/** GET /api/tasks/[id]/checklist — list checklist items for a task. */
export const GET = withAuth(
  { blockedRoles: ["client"] },
  async (_req, _ctx, params) => {
    const pool = getPool();
    const taskId = params.id;

    const { rows: taskRows } = await pool.query(
      `SELECT id FROM task WHERE id = $1`,
      [taskId]
    );
    if (taskRows.length === 0) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const { rows } = await pool.query(
      `SELECT * FROM task_checklist_item WHERE task_id = $1 ORDER BY position, created_at`,
      [taskId]
    );
    return NextResponse.json(rows);
  }
);

/** POST /api/tasks/[id]/checklist — add a checklist item. */
export const POST = withAuth(
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
      const title = body.title?.trim();
      if (!title) {
        return NextResponse.json(
          { error: "Title is required" },
          { status: 400 }
        );
      }

      const {
        rows: [item],
      } = await pool.query(
        `INSERT INTO task_checklist_item (task_id, title, position)
         VALUES ($1, $2, COALESCE((SELECT MAX(position) + 1 FROM task_checklist_item WHERE task_id = $1), 0))
         RETURNING *`,
        [taskId, title]
      );
      return NextResponse.json(item, { status: 201 });
    } catch (err) {
      console.error("Checklist POST error:", err);
      return NextResponse.json(
        {
          error: err instanceof Error ? err.message : "Failed to create item",
        },
        { status: 500 }
      );
    }
  }
);
