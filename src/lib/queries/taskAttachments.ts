import { getPool } from "@/lib/db";

// ---------------------------------------------------------------------------
// Task Attachments (standalone tasks)
// ---------------------------------------------------------------------------

/** Get attachments for a standalone task. */
export async function getTaskAttachments(taskId: string) {
  const pool = getPool();
  const { rows } = await pool.query(
    `SELECT * FROM attachment WHERE standalone_task_id = $1 ORDER BY created_at DESC`,
    [taskId]
  );
  return rows;
}

/** Get a task's project_id. */
export async function getTaskProjectId(taskId: string): Promise<string | null> {
  const pool = getPool();
  const {
    rows: [row],
  } = await pool.query(`SELECT project_id FROM task WHERE id = $1`, [taskId]);
  return row?.project_id ?? null;
}

/** Get a task's org_id. */
export async function getTaskOrgId(taskId: string): Promise<string | null> {
  const pool = getPool();
  const {
    rows: [row],
  } = await pool.query(`SELECT org_id FROM task WHERE id = $1`, [taskId]);
  return row?.org_id ?? null;
}

/** Create an attachment for a standalone task. */
export async function createTaskAttachment(params: {
  taskId: string;
  projectId: string | null;
  uploadedBy: string;
  fileUrl: string;
  fileName: string;
  fileSize?: number | null;
}) {
  const pool = getPool();
  const {
    rows: [attachment],
  } = await pool.query(
    `INSERT INTO attachment (standalone_task_id, project_id, uploaded_by, file_url, file_name, file_size)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [
      params.taskId,
      params.projectId,
      params.uploadedBy,
      params.fileUrl,
      params.fileName,
      params.fileSize ?? null,
    ]
  );
  return attachment;
}

/** Get a standalone task attachment by ID and task ID. */
export async function getStandaloneTaskAttachment(
  attachmentId: string,
  taskId: string
) {
  const pool = getPool();
  const { rows } = await pool.query(
    `SELECT id, uploaded_by FROM attachment WHERE id = $1 AND standalone_task_id = $2`,
    [attachmentId, taskId]
  );
  return rows[0] || null;
}

/** Delete an attachment by ID, scoped to a standalone task. */
export async function deleteAttachmentById(
  attachmentId: string,
  taskId: string
) {
  const pool = getPool();
  await pool.query(
    `DELETE FROM attachment WHERE id = $1 AND standalone_task_id = $2`,
    [attachmentId, taskId]
  );
}
