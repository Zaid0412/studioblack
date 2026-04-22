import { getPool } from "@/lib/db";

/** Get comments for a project/phase/task. */
export async function getComments(filters: {
  projectId: string;
  phaseId?: string;
  taskId?: string;
}) {
  const pool = getPool();
  let query = `SELECT c.*, u.name AS user_name, u.role AS user_role
               FROM comment c JOIN "user" u ON u.id = c.user_id
               WHERE c.project_id = $1`;
  const params: string[] = [filters.projectId];

  if (filters.taskId) {
    query += ` AND c.task_id = $${params.length + 1}`;
    params.push(filters.taskId);
  } else if (filters.phaseId) {
    query += ` AND c.phase_id = $${params.length + 1} AND c.task_id IS NULL`;
    params.push(filters.phaseId);
  } else {
    query += ` AND c.phase_id IS NULL AND c.task_id IS NULL`;
  }

  query += ` ORDER BY c.created_at`;
  const { rows } = await pool.query(query, params);
  return rows;
}

// ---------------------------------------------------------------------------
// Comments (project-level)
// ---------------------------------------------------------------------------

/** Create a comment on a project/phase/task. */
export async function createComment(params: {
  projectId: string;
  phaseId: string | null;
  taskId: string | null;
  userId: string;
  content: string;
}) {
  const pool = getPool();
  const {
    rows: [comment],
  } = await pool.query(
    `INSERT INTO comment (project_id, phase_id, task_id, user_id, content)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [
      params.projectId,
      params.phaseId,
      params.taskId,
      params.userId,
      params.content,
    ]
  );
  return comment;
}
