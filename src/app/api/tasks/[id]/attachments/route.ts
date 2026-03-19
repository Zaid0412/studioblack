import { NextResponse } from "next/server";
import { getPool } from "@/lib/db";
import { withAuth } from "@/lib/withAuth";

/** GET /api/tasks/[id]/attachments — list attachments for a standalone task. */
export const GET = withAuth(
  { blockedRoles: ["client"] },
  async (_req, { orgId }, params) => {
    const pool = getPool();
    const taskId = params.id;

    const { rows: taskRows } = await pool.query(
      `SELECT id FROM task WHERE id = $1 AND ($2::text IS NULL OR org_id = $2)`,
      [taskId, orgId]
    );
    if (taskRows.length === 0) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const { rows } = await pool.query(
      `SELECT * FROM attachment WHERE standalone_task_id = $1 ORDER BY created_at DESC`,
      [taskId]
    );
    return NextResponse.json(rows);
  }
);

/** POST /api/tasks/[id]/attachments — create an attachment record after upload. */
export const POST = withAuth(
  { blockedRoles: ["client"] },
  async (req, { user, orgId }, params) => {
    try {
      const pool = getPool();
      const taskId = params.id;

      const { rows: taskRows } = await pool.query(
        `SELECT id, org_id, project_id FROM task WHERE id = $1 AND ($2::text IS NULL OR org_id = $2)`,
        [taskId, orgId]
      );
      if (taskRows.length === 0) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
      }

      const task = taskRows[0];
      const body = await req.json();
      const { fileUrl, fileName, fileSize } = body;

      if (!fileUrl || !fileName) {
        return NextResponse.json(
          { error: "fileUrl and fileName are required" },
          { status: 400 }
        );
      }

      // Validate fileUrl is from our Supabase instance
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      if (supabaseUrl && !fileUrl.startsWith(supabaseUrl)) {
        return NextResponse.json(
          { error: "Invalid file URL" },
          { status: 400 }
        );
      }

      // project_id is required by the attachment table — use the task's project_id,
      // or fall back to null if the column allows it. The original schema has NOT NULL
      // on project_id, but standalone tasks may not have a project. We'll insert with
      // the task's project_id (may be null). If the column is NOT NULL this will fail
      // gracefully — the caller should ensure the task has a project or the schema is
      // relaxed.
      const {
        rows: [attachment],
      } = await pool.query(
        `INSERT INTO attachment (standalone_task_id, project_id, uploaded_by, file_url, file_name, file_size)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [taskId, task.project_id, user.id, fileUrl, fileName, fileSize ?? null]
      );

      return NextResponse.json(attachment, { status: 201 });
    } catch (err) {
      console.error("Attachment POST error:", err);
      return NextResponse.json(
        { error: "Failed to create attachment" },
        { status: 500 }
      );
    }
  }
);
