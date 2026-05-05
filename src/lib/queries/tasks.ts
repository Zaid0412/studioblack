import { getPool } from "@/lib/db";
import { DEFAULT_PAGE_LIMIT } from "@/lib/constants";
import { escapeSqlLike } from "./helpers";
import { verifyPhaseOwnership } from "./phaseTasks";
import type { TaskBucket } from "@/lib/validations";

/** Verify a task belongs to a project (via its phase). */
export async function verifyTaskOwnership(
  taskId: string,
  projectId: string
): Promise<boolean> {
  const pool = getPool();
  const { rows } = await pool.query(
    `SELECT 1 FROM phase_task t
     JOIN project_phase pp ON pp.id = t.phase_id
     WHERE t.id = $1 AND pp.project_id = $2`,
    [taskId, projectId]
  );
  return rows.length > 0;
}

/**
 * Verify that optional phaseId/taskId belong to the given project.
 * Returns an error string if verification fails, or undefined if OK.
 */
export async function verifyResourceOwnership(
  projectId: string,
  phaseId?: string | null,
  taskId?: string | null
): Promise<string | undefined> {
  if (phaseId) {
    const owned = await verifyPhaseOwnership(phaseId, projectId);
    if (!owned) return "Phase not found in this project";
  }
  if (taskId) {
    const owned = await verifyTaskOwnership(taskId, projectId);
    if (!owned) return "Task not found in this project";
  }
  return undefined;
}

/** Get all tasks assigned to a specific user across all projects. */
export async function getTasksByAssignee(userId: string) {
  const pool = getPool();
  const { rows } = await pool.query(
    `SELECT t.*, pp.name AS phase_name, pp.phase_order,
            p.name AS project_name, p.id AS project_id
     FROM phase_task t
     JOIN project_phase pp ON pp.id = t.phase_id
     JOIN project p ON p.id = pp.project_id
     WHERE t.assigned_to = $1
     ORDER BY
       CASE WHEN t.status = 'pending' THEN 0
            WHEN t.status = 'in_progress' THEN 1
            ELSE 2 END,
       t.due_date NULLS LAST,
       t.created_at DESC`,
    [userId]
  );
  return rows;
}

// ---------------------------------------------------------------------------
// Task Manager
// ---------------------------------------------------------------------------

/** Check that a task exists and belongs to the given org. */
export async function verifyTaskAccess(
  taskId: string,
  orgId: string | null
): Promise<boolean> {
  if (!orgId) return false;
  const pool = getPool();
  const { rows } = await pool.query(
    `SELECT id FROM task WHERE id = $1 AND org_id = $2`,
    [taskId, orgId]
  );
  return rows.length > 0;
}

interface TaskFilters {
  orgId: string;
  bucket?: TaskBucket;
  userId: string;
  /** When true, all buckets are scoped to tasks assigned to the user. */
  assigneeOnly?: boolean;
  projectId?: string;
  status?: string;
  priority?: string;
  category?: string;
  phaseId?: string;
  search?: string;
  page?: number;
  limit?: number;
}

/**
 * Buckets whose data lives outside the `task` table — currently approval
 * reviews, pin/task comments, reminders, and mentions. The `getTasks` query
 * short-circuits to an empty result for these (the `task_comment` queries
 * and the future approval/reminder/mention work supply the actual rows).
 */
const NON_TASK_BUCKETS = new Set<TaskBucket>([
  "reminders",
  "mentions",
  "my_requests",
  "my_approvals",
  "my_comments",
  "all_requests",
]);

/** Fetch tasks with bucket-based filtering and optional search/status/priority/category filters. */
export async function getTasks(filters: TaskFilters) {
  const pool = getPool();

  // Approval/comment/reminder/mention buckets aren't sourced from the `task`
  // table; return an empty page so the caller can substitute the correct
  // dataset (or render an empty state until the data layer lands).
  if (filters.bucket && NON_TASK_BUCKETS.has(filters.bucket)) {
    return { tasks: [], total: 0 };
  }

  const conditions: string[] = ["t.org_id = $1"];
  const values: unknown[] = [filters.orgId];
  let idx = 2;

  // Bucket filters
  switch (filters.bucket) {
    case "important":
      // Open tasks assigned to me, sorted later by priority + due date.
      conditions.push(
        `t.assigned_to = $${idx} AND t.status NOT IN ('completed', 'archived')`
      );
      values.push(filters.userId);
      idx++;
      break;
    case "tasks_for_me":
      conditions.push(`t.assigned_to = $${idx}`);
      values.push(filters.userId);
      idx++;
      break;
    case "tasks_by_me":
      conditions.push(
        `t.created_by = $${idx} AND (t.assigned_to IS NULL OR t.assigned_to != $${idx})`
      );
      values.push(filters.userId);
      idx++;
      break;
    case "all_tasks":
    default:
      // Org-wide list — exclude archived.
      conditions.push(`t.status != 'archived'`);
  }

  // Architects can only see tasks assigned to them
  if (filters.assigneeOnly) {
    conditions.push(`t.assigned_to = $${idx}`);
    values.push(filters.userId);
    idx++;
  }

  // Additional filters
  if (filters.projectId) {
    conditions.push(`t.project_id = $${idx}`);
    values.push(filters.projectId);
    idx++;
  }
  if (filters.status) {
    conditions.push(`t.status = $${idx}`);
    values.push(filters.status);
    idx++;
  }
  if (filters.priority) {
    conditions.push(`t.priority = $${idx}`);
    values.push(filters.priority);
    idx++;
  }
  if (filters.category) {
    conditions.push(`t.category = $${idx}`);
    values.push(filters.category);
    idx++;
  }
  if (filters.phaseId) {
    conditions.push(`(t.phase_id = $${idx} OR t.phase_id IS NULL)`);
    values.push(filters.phaseId);
    idx++;
  }
  if (filters.search) {
    const safeSearch = escapeSqlLike(filters.search.slice(0, 200));
    conditions.push(`(t.title ILIKE $${idx} OR t.description ILIKE $${idx})`);
    values.push(`%${safeSearch}%`);
    idx++;
  }

  // Add userId param for is_starred subquery
  values.push(filters.userId);
  const starIdx = idx;
  idx++;

  // Pagination params
  const page = filters.page ?? 1;
  const limit = filters.limit ?? DEFAULT_PAGE_LIMIT;
  const offset = (page - 1) * limit;

  values.push(limit);
  const limitIdx = idx;
  idx++;

  values.push(offset);
  const offsetIdx = idx;
  idx++;

  const { rows } = await pool.query(
    `SELECT t.*,
            u_assigned.name AS assigned_to_name,
            u_created.name AS created_by_name,
            p.name AS project_name,
            pp.name AS phase_name,
            EXISTS (SELECT 1 FROM task_star ts WHERE ts.task_id = t.id AND ts.user_id = $${starIdx}) AS is_starred,
            COALESCE(cl.total, 0)::int AS checklist_total,
            COALESCE(cl.done, 0)::int AS checklist_done,
            pc.id AS pin_comment_id,
            pc.attachment_id AS pin_attachment_id,
            COUNT(*) OVER()::int AS _total_count
     FROM task t
     LEFT JOIN "user" u_assigned ON u_assigned.id = t.assigned_to
     LEFT JOIN "user" u_created ON u_created.id = t.created_by
     LEFT JOIN project p ON p.id = t.project_id
     LEFT JOIN project_phase pp ON pp.id = t.phase_id
     LEFT JOIN (
       SELECT task_id, COUNT(*)::int AS total, COUNT(*) FILTER (WHERE is_done)::int AS done
       FROM task_checklist_item GROUP BY task_id
     ) cl ON cl.task_id = t.id
     LEFT JOIN LATERAL (
       SELECT id, attachment_id FROM pin_comment WHERE task_id = t.id LIMIT 1
     ) pc ON true
     WHERE ${conditions.join(" AND ")}
     ORDER BY
       ${
         filters.bucket === "important"
           ? `CASE t.priority
              WHEN 'urgent' THEN 0 WHEN 'high' THEN 1
              WHEN 'medium' THEN 2 WHEN 'low' THEN 3 ELSE 4 END,
            t.due_date NULLS LAST,`
           : ""
       }
       t.created_at DESC
     LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
    values
  );

  const total = rows.length > 0 ? rows[0]._total_count : 0;
  // Strip the internal _total_count field from results
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const tasks = rows.map(({ _total_count, ...rest }) => rest);

  return { tasks, total };
}

/** Fetch a single task by ID with joined user, project, and phase names. */
export async function getTaskById(
  taskId: string,
  opts?: { userId?: string; orgId?: string }
) {
  const pool = getPool();
  const userId = opts?.userId;
  const orgId = opts?.orgId;

  const conditions: string[] = ["t.id = $1"];
  const params: unknown[] = [taskId];
  let idx = 2;

  if (orgId) {
    conditions.push(`t.org_id = $${idx}`);
    params.push(orgId);
    idx++;
  }

  const starClause = userId
    ? `EXISTS (SELECT 1 FROM task_star ts WHERE ts.task_id = t.id AND ts.user_id = $${idx})`
    : `false`;
  if (userId) {
    params.push(userId);
    idx++;
  }

  const { rows } = await pool.query(
    `SELECT t.*,
            u_assigned.name AS assigned_to_name,
            u_created.name AS created_by_name,
            p.name AS project_name,
            pp.name AS phase_name,
            ${starClause} AS is_starred,
            COALESCE(cl.total, 0)::int AS checklist_total,
            COALESCE(cl.done, 0)::int AS checklist_done,
            pc.id AS pin_comment_id,
            pc.attachment_id AS pin_attachment_id
     FROM task t
     LEFT JOIN "user" u_assigned ON u_assigned.id = t.assigned_to
     LEFT JOIN "user" u_created ON u_created.id = t.created_by
     LEFT JOIN project p ON p.id = t.project_id
     LEFT JOIN project_phase pp ON pp.id = t.phase_id
     LEFT JOIN (
       SELECT task_id, COUNT(*)::int AS total, COUNT(*) FILTER (WHERE is_done)::int AS done
       FROM task_checklist_item GROUP BY task_id
     ) cl ON cl.task_id = t.id
     LEFT JOIN LATERAL (
       SELECT id, attachment_id FROM pin_comment WHERE task_id = t.id LIMIT 1
     ) pc ON true
     WHERE ${conditions.join(" AND ")}`,
    params
  );
  return rows[0] || null;
}

/**
 * Get task counts for each bucket in the redesigned sidebar.
 *
 * Two parallel queries: one over `task` for the action-item buckets and one
 * over `pin_comment` (joined through `attachment` → `project`) for the
 * approval-flavoured buckets. The list endpoints for the approval buckets
 * still return empty rows for now — the row-level UI lands with the
 * polymorphic Request entity work in Phase 4 — but the badges are real.
 *
 * `reminders` and `mentions` are still 0 (Phase 2/3).
 *
 * `my_approvals` is 0 because pin_comment has no reviewer_id; without a
 * concept of "this comment is waiting on user X's decision" we can't count
 * it accurately, and a global "everyone's pending requests" would be the
 * `all_requests` bucket instead.
 */
export async function getTaskBucketCounts(
  orgId: string,
  userId: string,
  assigneeOnly?: boolean
): Promise<Record<string, number>> {
  const pool = getPool();
  const assigneeFilter = assigneeOnly ? " AND t.assigned_to = $2" : "";

  const [taskRow, approvalRow] = await Promise.all([
    pool
      .query(
        `SELECT
           COUNT(*) FILTER (WHERE t.status != 'archived')::int AS all_tasks,
           COUNT(*) FILTER (WHERE t.assigned_to = $2 AND t.status NOT IN ('completed', 'archived'))::int AS important,
           COUNT(*) FILTER (WHERE t.assigned_to = $2 AND t.status != 'archived')::int AS tasks_for_me,
           COUNT(*) FILTER (WHERE t.created_by = $2 AND (t.assigned_to IS NULL OR t.assigned_to != $2) AND t.status != 'archived')::int AS tasks_by_me
         FROM task t
         WHERE t.org_id = $1${assigneeFilter}`,
        [orgId, userId]
      )
      .then((r) => r.rows[0]),
    pool
      .query(
        `SELECT
           COUNT(*) FILTER (
             WHERE pc.user_id = $2
               AND (pc.request_approval OR pc.request_changes)
               AND NOT pc.resolved
           )::int AS my_requests,
           COUNT(*) FILTER (WHERE pc.user_id = $2)::int AS my_comments,
           COUNT(*) FILTER (
             WHERE pc.request_approval AND NOT pc.resolved
           )::int AS all_requests
         FROM pin_comment pc
         JOIN attachment a ON a.id = pc.attachment_id
         JOIN project p ON p.id = a.project_id
         WHERE p.org_id = $1`,
        [orgId, userId]
      )
      .then((r) => r.rows[0]),
  ]);

  return {
    important: taskRow.important ?? 0,
    reminders: 0,
    mentions: 0,
    tasks_for_me: taskRow.tasks_for_me ?? 0,
    tasks_by_me: taskRow.tasks_by_me ?? 0,
    my_requests: approvalRow.my_requests ?? 0,
    my_approvals: 0,
    my_comments: approvalRow.my_comments ?? 0,
    all_tasks: taskRow.all_tasks ?? 0,
    all_requests: approvalRow.all_requests ?? 0,
  };
}

// ---------------------------------------------------------------------------
// Task Star (toggle)
// ---------------------------------------------------------------------------

/** Toggle star on a task for a user. Returns { starred: boolean }. */
export async function toggleTaskStar(
  userId: string,
  taskId: string
): Promise<{ starred: boolean }> {
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { rowCount } = await client.query(
      "DELETE FROM task_star WHERE user_id = $1 AND task_id = $2",
      [userId, taskId]
    );
    if (rowCount === 0) {
      await client.query(
        "INSERT INTO task_star (user_id, task_id) VALUES ($1, $2)",
        [userId, taskId]
      );
      await client.query("COMMIT");
      return { starred: true };
    }
    await client.query("COMMIT");
    return { starred: false };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

// ---------------------------------------------------------------------------
// Task CRUD (standalone tasks)
// ---------------------------------------------------------------------------

/** Create a standalone task. */
export async function createTask(params: {
  orgId: string;
  projectId: string | null;
  phaseId: string | null;
  title: string;
  description: string;
  priority: string;
  category: string;
  createdBy: string;
  assignedTo: string;
  dueDate: string | null;
}) {
  const pool = getPool();
  const {
    rows: [task],
  } = await pool.query(
    `INSERT INTO task (org_id, project_id, phase_id, title, description, priority, category, created_by, assigned_to, due_date)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     RETURNING *`,
    [
      params.orgId,
      params.projectId,
      params.phaseId,
      params.title,
      params.description,
      params.priority,
      params.category,
      params.createdBy,
      params.assignedTo,
      params.dueDate,
    ]
  );
  return task;
}

/** Update a standalone task with dynamic fields. */
const TASK_COLS = new Set([
  "title",
  "description",
  "status",
  "priority",
  "category",
  "assigned_to",
  "project_id",
  "phase_id",
  "due_date",
  "reminder_at",
]);

/** Update a task with the given fields. */
export async function updateTask(
  taskId: string,
  fields: Record<string, unknown>,
  opts?: { completedAtTransition?: "set" | "clear" }
) {
  const updates: string[] = [];
  const values: unknown[] = [];
  let idx = 1;

  for (const [col, value] of Object.entries(fields)) {
    if (value !== undefined && TASK_COLS.has(col)) {
      updates.push(`"${col}" = $${idx}`);
      values.push(value === "" ? null : value);
      idx++;
    }
  }

  if (opts?.completedAtTransition === "set") {
    updates.push(`completed_at = now()`);
  } else if (opts?.completedAtTransition === "clear") {
    updates.push(`completed_at = NULL`);
  }

  if (updates.length === 0) return null;

  updates.push(`updated_at = now()`);
  values.push(taskId);

  const pool = getPool();
  const {
    rows: [updated],
  } = await pool.query(
    `UPDATE task SET ${updates.join(", ")} WHERE id = $${idx} RETURNING *`,
    values
  );
  return updated;
}

/** Delete a standalone task by ID. */
export async function deleteTask(taskId: string) {
  const pool = getPool();
  await pool.query(`DELETE FROM task WHERE id = $1`, [taskId]);
}
