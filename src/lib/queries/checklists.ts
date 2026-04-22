import { getPool } from "@/lib/db";

// ---------------------------------------------------------------------------
// Checklist Items
// ---------------------------------------------------------------------------

/** Get checklist items for a task. */
export async function getChecklistItems(taskId: string) {
  const pool = getPool();
  const { rows } = await pool.query(
    `SELECT * FROM task_checklist_item WHERE task_id = $1 ORDER BY position, created_at`,
    [taskId]
  );
  return rows;
}

/** Create a checklist item for a task. */
export async function createChecklistItem(taskId: string, title: string) {
  const pool = getPool();
  const {
    rows: [item],
  } = await pool.query(
    `INSERT INTO task_checklist_item (task_id, title, position)
     VALUES ($1, $2, COALESCE((SELECT MAX(position) + 1 FROM task_checklist_item WHERE task_id = $1), 0))
     RETURNING *`,
    [taskId, title]
  );
  return item;
}

/** Update a checklist item. Returns the updated item or null if not found. */
export async function updateChecklistItem(
  itemId: string,
  taskId: string,
  fields: { title?: string; is_done?: boolean; position?: number }
) {
  const updates: string[] = [];
  const values: unknown[] = [];
  let idx = 1;

  if (fields.title !== undefined) {
    updates.push(`title = $${idx}`);
    values.push(fields.title);
    idx++;
  }
  if (fields.is_done !== undefined) {
    updates.push(`is_done = $${idx}`);
    values.push(fields.is_done);
    idx++;
  }
  if (fields.position !== undefined) {
    updates.push(`position = $${idx}`);
    values.push(fields.position);
    idx++;
  }

  if (updates.length === 0) return null;

  const pool = getPool();
  values.push(itemId, taskId);
  const {
    rows: [updated],
  } = await pool.query(
    `UPDATE task_checklist_item SET ${updates.join(", ")} WHERE id = $${idx} AND task_id = $${idx + 1} RETURNING *`,
    values
  );
  return updated || null;
}

/** Delete a checklist item. Returns true if deleted. */
export async function deleteChecklistItem(
  itemId: string,
  taskId: string
): Promise<boolean> {
  const pool = getPool();
  const { rowCount } = await pool.query(
    `DELETE FROM task_checklist_item WHERE id = $1 AND task_id = $2`,
    [itemId, taskId]
  );
  return (rowCount ?? 0) > 0;
}

/** Reorder checklist items by their IDs. */
export async function reorderChecklistItems(
  taskId: string,
  orderedIds: string[]
) {
  const pool = getPool();
  await pool.query(
    `UPDATE task_checklist_item
     SET position = data.pos
     FROM (SELECT unnest($1::uuid[]) AS id, generate_series(0, $2::int) AS pos) data
     WHERE task_checklist_item.id = data.id AND task_checklist_item.task_id = $3`,
    [orderedIds, orderedIds.length - 1, taskId]
  );
}
