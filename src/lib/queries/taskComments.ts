import { getPool } from "@/lib/db";
import type { TaskComment, TaskCommentAttachment } from "@/types";

/**
 * Task comments are GH-issue-style — a flat thread per task with inline file
 * attachments stored alongside the body. They power the comments section in
 * the task side panel and on `/tasks/[id]`. There's no nesting (no replies)
 * by design; threads stay simple.
 *
 * Reads go through `getTaskActivity` (in `taskActivity.ts`) which merges
 * comments and audit events in a single UNION query.
 */

/** Fetch one comment by id, scoped to org. Returns null if missing. */
export async function getTaskComment(
  orgId: string,
  commentId: string
): Promise<TaskComment | null> {
  const pool = getPool();
  const { rows } = await pool.query(
    `SELECT c.*, u.name AS author_name
     FROM task_comment c
     JOIN "user" u ON u.id = c.author_id
     WHERE c.org_id = $1 AND c.id = $2`,
    [orgId, commentId]
  );
  return (rows[0] ?? null) as TaskComment | null;
}

/**
 * Insert a comment and return the created row with the author name joined.
 * Returns null when the target task doesn't exist in the caller's org —
 * the existence check is folded into the INSERT via a CTE so the route
 * doesn't need a separate `getTaskById` round trip.
 */
export async function createTaskComment(params: {
  orgId: string;
  taskId: string;
  authorId: string;
  body: string;
  attachments?: TaskCommentAttachment[];
}): Promise<TaskComment | null> {
  const pool = getPool();
  const { rows } = await pool.query(
    `WITH allowed_task AS (
       SELECT id FROM task WHERE id = $2 AND org_id = $1
     ),
     inserted AS (
       INSERT INTO task_comment (org_id, task_id, author_id, body, attachments)
       SELECT $1, t.id, $3, $4, $5::jsonb FROM allowed_task t
       RETURNING *
     )
     SELECT i.*, u.name AS author_name
     FROM inserted i
     JOIN "user" u ON u.id = i.author_id`,
    [
      params.orgId,
      params.taskId,
      params.authorId,
      params.body,
      JSON.stringify(params.attachments ?? []),
    ]
  );
  return (rows[0] ?? null) as TaskComment | null;
}

/**
 * Update a comment's body and/or attachments. The `taskId` filter folds
 * the task-ownership check into the same query so the route doesn't need
 * a separate `getTaskById` round trip. Returns null when nothing matched
 * — the route disambiguates 404 (no such comment in this task) from 403
 * (wrong author) with a single follow-up `getTaskComment` lookup on the
 * failure path.
 */
export async function updateTaskComment(params: {
  orgId: string;
  commentId: string;
  taskId: string;
  authorId: string;
  body?: string;
  attachments?: TaskCommentAttachment[];
}): Promise<TaskComment | null> {
  const sets: string[] = [];
  const values: unknown[] = [];
  let idx = 1;

  if (params.body !== undefined) {
    sets.push(`body = $${idx}`);
    values.push(params.body);
    idx++;
  }
  if (params.attachments !== undefined) {
    sets.push(`attachments = $${idx}::jsonb`);
    values.push(JSON.stringify(params.attachments));
    idx++;
  }
  if (sets.length === 0) {
    return getTaskComment(params.orgId, params.commentId);
  }

  sets.push(`updated_at = now()`);

  values.push(params.orgId);
  const orgIdx = idx;
  idx++;
  values.push(params.commentId);
  const commentIdx = idx;
  idx++;
  values.push(params.taskId);
  const taskIdx = idx;
  idx++;
  values.push(params.authorId);
  const authorIdx = idx;
  idx++;

  const pool = getPool();
  const { rows } = await pool.query(
    `WITH updated AS (
       UPDATE task_comment
       SET ${sets.join(", ")}
       WHERE org_id = $${orgIdx}
         AND id = $${commentIdx}
         AND task_id = $${taskIdx}
         AND author_id = $${authorIdx}
       RETURNING *
     )
     SELECT u.*, usr.name AS author_name
     FROM updated u
     JOIN "user" usr ON usr.id = u.author_id`,
    values
  );
  return (rows[0] ?? null) as TaskComment | null;
}

/**
 * Delete a comment. The `taskId` filter folds the task-ownership check
 * into the WHERE clause. Returns true when a row was deleted; the route
 * disambiguates 404 vs 403 only on the failure path.
 */
export async function deleteTaskComment(params: {
  orgId: string;
  commentId: string;
  taskId: string;
  authorId: string;
}): Promise<boolean> {
  const pool = getPool();
  const { rowCount } = await pool.query(
    `DELETE FROM task_comment
     WHERE org_id = $1 AND id = $2 AND task_id = $3 AND author_id = $4`,
    [params.orgId, params.commentId, params.taskId, params.authorId]
  );
  return (rowCount ?? 0) > 0;
}
