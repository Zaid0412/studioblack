import { NextResponse } from "next/server";
import { getPool } from "@/lib/db";
import { verifyTaskAccess } from "@/lib/queries";
import { parseBody, updateChecklistItemSchema } from "@/lib/validations";
import { withAuth } from "@/lib/withAuth";

/** PATCH /api/tasks/[id]/checklist/[itemId] — update a checklist item. */
export const PATCH = withAuth(
  { blockedRoles: ["client"] },
  async (req, { orgId }, params) => {
    const { id: taskId, itemId } = params;
    if (!(await verifyTaskAccess(taskId, orgId))) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const raw = await req.json();
    const parsed = parseBody(updateChecklistItemSchema, raw);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }
    const { title, is_done, position } = parsed.data;

    const updates: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    if (title !== undefined) {
      updates.push(`title = $${idx}`);
      values.push(title);
      idx++;
    }

    if (is_done !== undefined) {
      updates.push(`is_done = $${idx}`);
      values.push(is_done);
      idx++;
    }

    if (position !== undefined) {
      updates.push(`position = $${idx}`);
      values.push(position);
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
