import { getPool } from "@/lib/db";

/** Get tasks for a phase, scoped to a project for security. */
export async function getPhaseTasks(phaseId: string, projectId: string) {
  const pool = getPool();
  const { rows } = await pool.query(
    `SELECT t.*, u.name AS assigned_name
     FROM phase_task t
     JOIN project_phase pp ON pp.id = t.phase_id
     LEFT JOIN "user" u ON u.id = t.assigned_to
     WHERE t.phase_id = $1 AND pp.project_id = $2
     ORDER BY t.created_at`,
    [phaseId, projectId]
  );
  return rows;
}

/** Verify a phase belongs to a project. */
export async function verifyPhaseOwnership(
  phaseId: string,
  projectId: string
): Promise<boolean> {
  const pool = getPool();
  const { rows } = await pool.query(
    `SELECT 1 FROM project_phase WHERE id = $1 AND project_id = $2`,
    [phaseId, projectId]
  );
  return rows.length > 0;
}

/** Get tasks pending client review for a project. */
export async function getTasksPendingReview(projectId: string) {
  const pool = getPool();
  const { rows } = await pool.query(
    `SELECT t.*, pp.name AS phase_name, pp.phase_order, u.name AS assigned_name
     FROM phase_task t
     JOIN project_phase pp ON pp.id = t.phase_id
     LEFT JOIN "user" u ON u.id = t.assigned_to
     WHERE pp.project_id = $1
       AND t.requires_client_review = true
       AND t.review_status = 'pending_review'
     ORDER BY pp.phase_order, t.created_at`,
    [projectId]
  );
  return rows;
}

// ---------------------------------------------------------------------------
// Phase Tasks (project sub-tasks)
// ---------------------------------------------------------------------------

/** Create a phase task. */
export async function createPhaseTask(params: {
  phaseId: string;
  title: string;
  description: string;
  assignedTo: string | null;
  dueDate: string | null;
}) {
  const pool = getPool();
  const {
    rows: [task],
  } = await pool.query(
    `INSERT INTO phase_task (phase_id, title, description, assigned_to, due_date)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [
      params.phaseId,
      params.title,
      params.description,
      params.assignedTo,
      params.dueDate,
    ]
  );
  return task;
}

const PHASE_TASK_COLS = new Set([
  "title",
  "description",
  "status",
  "assigned_to",
  "due_date",
  "requires_client_review",
]);

/** Update a phase task with dynamic fields. */
export async function updatePhaseTask(
  taskId: string,
  fields: Record<string, unknown>
) {
  const updates: string[] = [];
  const values: unknown[] = [];
  let idx = 1;

  for (const [col, val] of Object.entries(fields)) {
    if (val !== undefined && PHASE_TASK_COLS.has(col)) {
      updates.push(`"${col}" = $${idx}`);
      values.push(val);
      idx++;
    }
  }

  if (updates.length === 0) return null;

  updates.push(`updated_at = now()`);
  values.push(taskId);

  const pool = getPool();
  const {
    rows: [updated],
  } = await pool.query(
    `UPDATE phase_task SET ${updates.join(", ")} WHERE id = $${idx} RETURNING *`,
    values
  );
  return updated;
}

/** Mark a phase task for client review. */
export async function markPhaseTaskForReview(taskId: string) {
  const pool = getPool();
  const {
    rows: [task],
  } = await pool.query(
    `UPDATE phase_task
     SET requires_client_review = true,
         review_status = 'pending_review',
         updated_at = now()
     WHERE id = $1
     RETURNING *`,
    [taskId]
  );
  return task || null;
}

/** Get a phase task that is pending review. */
export async function getPhaseTaskPendingReview(taskId: string) {
  const pool = getPool();
  const {
    rows: [row],
  } = await pool.query(
    `SELECT * FROM phase_task WHERE id = $1 AND review_status = 'pending_review'`,
    [taskId]
  );
  return row || null;
}

/** Update a phase task's review status and status. */
export async function updatePhaseTaskReviewStatus(
  taskId: string,
  action: "approved" | "changes_requested"
) {
  const pool = getPool();
  const {
    rows: [task],
  } = await pool.query(
    `UPDATE phase_task
     SET review_status = $1,
         status = CASE WHEN $1 = 'approved' THEN 'approved' ELSE 'changes_requested' END,
         updated_at = now()
     WHERE id = $2
     RETURNING *`,
    [action, taskId]
  );
  return task;
}
