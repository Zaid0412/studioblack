import { getPool } from "@/lib/db";
import type { TaskComment, TaskCommentAttachment } from "@/types";

/**
 * Task comments are GH-issue-style — a flat thread per task with inline file
 * attachments stored alongside the body. They power the comments section in
 * the task side panel and on `/tasks/[id]`. There's no nesting (no replies)
 * by design; threads stay simple.
 */

/** List comments on a task in chronological order, with author names joined. */
export async function listTaskComments(
  orgId: string,
  taskId: string
): Promise<TaskComment[]> {
  const pool = getPool();
  const { rows } = await pool.query(
    `SELECT c.*, u.name AS author_name
     FROM task_comment c
     JOIN "user" u ON u.id = c.author_id
     WHERE c.org_id = $1 AND c.task_id = $2
     ORDER BY c.created_at ASC`,
    [orgId, taskId]
  );
  return rows as TaskComment[];
}

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

/** Insert a comment and return the created row with the author name joined. */
export async function createTaskComment(params: {
  orgId: string;
  taskId: string;
  authorId: string;
  body: string;
  attachments?: TaskCommentAttachment[];
}): Promise<TaskComment> {
  const pool = getPool();
  const { rows } = await pool.query(
    `WITH inserted AS (
       INSERT INTO task_comment (org_id, task_id, author_id, body, attachments)
       VALUES ($1, $2, $3, $4, $5::jsonb)
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
  return rows[0] as TaskComment;
}

/**
 * Update a comment's body and/or attachments. Only the original author may
 * call this — that's enforced at the route level via `WHERE author_id = $`.
 * Returns the updated row, or null when no row matched.
 */
export async function updateTaskComment(params: {
  orgId: string;
  commentId: string;
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
  values.push(params.authorId);
  const authorIdx = idx;
  idx++;

  const pool = getPool();
  const { rows } = await pool.query(
    `WITH updated AS (
       UPDATE task_comment
       SET ${sets.join(", ")}
       WHERE org_id = $${orgIdx} AND id = $${commentIdx} AND author_id = $${authorIdx}
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
 * Delete a comment. Restricted to the original author at the route level via
 * the `author_id` predicate. Returns true when a row was deleted.
 */
export async function deleteTaskComment(params: {
  orgId: string;
  commentId: string;
  authorId: string;
}): Promise<boolean> {
  const pool = getPool();
  const { rowCount } = await pool.query(
    `DELETE FROM task_comment
     WHERE org_id = $1 AND id = $2 AND author_id = $3`,
    [params.orgId, params.commentId, params.authorId]
  );
  return (rowCount ?? 0) > 0;
}
