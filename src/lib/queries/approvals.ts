import { getPool } from "@/lib/db";

/** Get approvals for a project. */
export async function getApprovals(projectId: string) {
  const pool = getPool();
  const { rows } = await pool.query(
    `SELECT a.*, u.name AS user_name
     FROM approval a JOIN "user" u ON u.id = a.user_id
     WHERE a.project_id = $1
     ORDER BY a.created_at DESC`,
    [projectId]
  );
  return rows;
}

/** Create an approval record. */
export async function createApproval(params: {
  projectId: string;
  phaseId: string | null;
  userId: string;
  decision: "approved" | "changes_requested";
  comment: string;
}) {
  const pool = getPool();
  const {
    rows: [approval],
  } = await pool.query(
    `INSERT INTO approval (project_id, phase_id, user_id, decision, comment)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [
      params.projectId,
      params.phaseId,
      params.userId,
      params.decision,
      params.comment,
    ]
  );
  return approval;
}
