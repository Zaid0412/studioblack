import { NextResponse } from "next/server";
import { getPool } from "@/lib/db";
import { verifyTaskAccess } from "@/lib/queries";
import { withAuth } from "@/lib/withAuth";

/** PATCH /api/tasks/[id]/checklist/[itemId] — update a checklist item. */
export const PATCH = withAuth(
  { blockedRoles: ["client"] },
  async (req, { orgId }, params) => {
    const { id: taskId, itemId } = params;
    if (!(await verifyTaskAccess(taskId, orgId))) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const body = await req.json();
    const updates: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    if (body.title !== undefined) {
      const title = body.title?.trim();
      if (!title) {
        return NextResponse.json(
          { error: "Title cannot be empty" },
          { status: 400 }
        );
      }
      updates.push(`title = $${idx}`);
      values.push(title);
      idx++;
    }

    if (body.is_done !== undefined) {
      updates.push(`is_done = $${idx}`);
      values.push(!!body.is_done);
      idx++;
    }

    if (body.position !== undefined) {
      updates.push(`position = $${idx}`);
      values.push(body.position);
      idx++;
    }

    if (updates.length === 0) {
      return NextResponse.json(
        { error: "No fields to update" },
        { status: 400 }
      );
    }

    const pool = getPool();
    values.push(itemId, taskId);
    const {
      rows: [updated],
    } = await pool.query(
      `UPDATE task_checklist_item SET ${updates.join(", ")} WHERE id = $${idx} AND task_id = $${idx + 1} RETURNING *`,
      values
    );

    if (!updated) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json(updated);
  }
);

/** DELETE /api/tasks/[id]/checklist/[itemId] — delete a checklist item. */
export const DELETE = withAuth(
  { blockedRoles: ["client"] },
  async (_req, { orgId }, params) => {
    const { id: taskId, itemId } = params;
    if (!(await verifyTaskAccess(taskId, orgId))) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const pool = getPool();
    const { rowCount } = await pool.query(
      `DELETE FROM task_checklist_item WHERE id = $1 AND task_id = $2`,
      [itemId, taskId]
    );

    if (rowCount === 0) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  }
);
