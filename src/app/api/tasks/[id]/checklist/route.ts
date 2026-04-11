import { NextResponse } from "next/server";
import { getPool } from "@/lib/db";
import { verifyTaskAccess } from "@/lib/queries";
import { parseBody, createChecklistItemSchema } from "@/lib/validations";
import { withAuth } from "@/lib/withAuth";

/** GET /api/tasks/[id]/checklist — list checklist items for a task. */
export const GET = withAuth(
  { blockedRoles: ["client"] },
  async (_req, { orgId }, params) => {
    const taskId = params.id;
    if (!(await verifyTaskAccess(taskId, orgId))) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const pool = getPool();
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
  async (req, { orgId }, params) => {
    try {
      const taskId = params.id;
      if (!(await verifyTaskAccess(taskId, orgId))) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
      }

      const raw = await req.json();
      const parsed = parseBody(createChecklistItemSchema, raw);
      if (!parsed.success) {
        return NextResponse.json({ error: parsed.error }, { status: 400 });
      }
      const { title } = parsed.data;

      const pool = getPool();
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
        { error: "Failed to create item" },
        { status: 500 }
      );
    }
  }
);
