import { NextResponse } from "next/server";
import { getPool } from "@/lib/db";
import { withAuth } from "@/lib/withAuth";

/** DELETE /api/tasks/[id]/attachments/[attachmentId] — delete an attachment. */
export const DELETE = withAuth(
  { blockedRoles: ["client"] },
  async (_req, { user, orgId }, params) => {
    const pool = getPool();
    const { id: taskId, attachmentId } = params;

    // Verify task exists and belongs to org
    const { rows: taskRows } = await pool.query(
      `SELECT id, org_id FROM task WHERE id = $1 AND ($2::text IS NULL OR org_id = $2)`,
      [taskId, orgId]
    );
    if (taskRows.length === 0) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    // Verify attachment exists and belongs to this task
    const { rows: attRows } = await pool.query(
      `SELECT id, uploaded_by FROM attachment WHERE id = $1 AND standalone_task_id = $2`,
      [attachmentId, taskId]
    );
    if (attRows.length === 0) {
      return NextResponse.json(
        { error: "Attachment not found" },
        { status: 404 }
      );
    }

    const attachment = attRows[0];
    const task = taskRows[0];

    // Only uploader or org admin/owner can delete
    if (attachment.uploaded_by !== user.id) {
      const { rows } = await pool.query(
        `SELECT role FROM member WHERE "organizationId" = $1 AND "userId" = $2`,
        [task.org_id, user.id]
      );
      const role = rows[0]?.role;
      if (role !== "owner" && role !== "admin") {
        return NextResponse.json(
          { error: "Only the uploader or org admins can delete attachments" },
          { status: 403 }
        );
      }
    }

    await pool.query(`DELETE FROM attachment WHERE id = $1`, [attachmentId]);
    return NextResponse.json({ success: true });
  }
);
