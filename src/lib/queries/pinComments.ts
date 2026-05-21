import { getPool } from "@/lib/db";
import type { PinShape, PinShapeData, PinShapeType } from "@/types";

// ── Pin Comments ─────────────────────────────────

/**
 * Common SELECT clause: pin_comment row + user_name + reply_count +
 *  aggregated `shapes` array sourced from pin_comment_shape.
 */
const PIN_SELECT = `pc.*,
        u.name AS user_name,
        (SELECT COUNT(*) FROM pin_comment r WHERE r.parent_id = pc.id)::int AS reply_count,
        COALESCE(
          (
            SELECT json_agg(
              json_build_object(
                'id', s.id,
                'pin_comment_id', s.pin_comment_id,
                'shape_type', s.shape_type,
                'shape_data', s.shape_data,
                'shape_color', s.shape_color,
                'shape_stroke_width', s.shape_stroke_width,
                'shape_opacity', s.shape_opacity,
                'shape_fill', s.shape_fill,
                'order_index', s.order_index,
                'created_at', s.created_at
              )
              ORDER BY s.order_index
            )
            FROM pin_comment_shape s
            WHERE s.pin_comment_id = pc.id
          ),
          '[]'::json
        ) AS shapes`;

/** Fetch top-level pin comments (no replies) for an attachment. */
export async function getPinComments(attachmentId: string) {
  const pool = getPool();
  const { rows } = await pool.query(
    `SELECT ${PIN_SELECT}
     FROM pin_comment pc
     JOIN "user" u ON u.id = pc.user_id
     WHERE pc.attachment_id = $1 AND pc.parent_id IS NULL
     ORDER BY pc.created_at ASC`,
    [attachmentId]
  );
  return rows;
}

/** Fetch replies for a specific pin comment. */
export async function getPinCommentReplies(parentId: string) {
  const pool = getPool();
  const { rows } = await pool.query(
    `SELECT ${PIN_SELECT}
     FROM pin_comment pc
     JOIN "user" u ON u.id = pc.user_id
     WHERE pc.parent_id = $1
     ORDER BY pc.created_at ASC`,
    [parentId]
  );
  return rows;
}

/** Fetch a single pin comment by ID with user name and reply count. */
export async function getPinCommentById(pinId: string) {
  const pool = getPool();
  const { rows } = await pool.query(
    `SELECT ${PIN_SELECT}
     FROM pin_comment pc
     JOIN "user" u ON u.id = pc.user_id
     WHERE pc.id = $1`,
    [pinId]
  );
  return rows[0] || null;
}

/**
 * Split a wire-format `PinShape` (geometry + style) into the column
 *  layout used by `pin_comment_shape`.
 */
function splitShape(shape: PinShape): {
  shape_type: PinShapeType;
  shape_data: PinShapeData;
  shape_color: string;
  shape_stroke_width: number;
  shape_opacity: number;
  shape_fill: boolean;
} {
  const { color, strokeWidth, opacity, fill } = shape;
  const shape_data: PinShapeData =
    shape.type === "rectangle"
      ? { x: shape.x, y: shape.y, w: shape.w, h: shape.h }
      : shape.type === "circle"
        ? { cx: shape.cx, cy: shape.cy, rx: shape.rx, ry: shape.ry }
        : { points: shape.points };
  return {
    shape_type: shape.type,
    shape_data,
    shape_color: color,
    shape_stroke_width: strokeWidth,
    shape_opacity: opacity,
    shape_fill: fill,
  };
}

/**
 * Insert N shapes for a pin_comment, in draw order. Caller owns the
 *  transaction client.
 */
async function insertShapesForPin(
  client: import("pg").PoolClient,
  pinId: string,
  shapes: ReadonlyArray<PinShape>
) {
  for (let i = 0; i < shapes.length; i++) {
    const s = splitShape(shapes[i]);
    await client.query(
      `INSERT INTO pin_comment_shape (pin_comment_id, shape_type, shape_data, shape_color, shape_stroke_width, shape_opacity, shape_fill, order_index)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        pinId,
        s.shape_type,
        s.shape_data,
        s.shape_color,
        s.shape_stroke_width,
        s.shape_opacity,
        s.shape_fill,
        i,
      ]
    );
  }
}

/**
 * Insert a new pin comment (or reply) and return the created row with its
 *  aggregated `shapes` array.
 */
export async function createPinComment(params: {
  attachmentId: string;
  userId: string;
  xPercent: number | null;
  yPercent: number | null;
  page: number | null;
  content: string;
  requestApproval?: boolean;
  requestChanges?: boolean;
  taskId?: string | null;
  parentId?: string | null;
  shapes?: ReadonlyArray<PinShape>;
}) {
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { rows: pinRows } = await client.query(
      `INSERT INTO pin_comment (attachment_id, user_id, x_percent, y_percent, page, content, request_approval, request_changes, task_id, parent_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING id`,
      [
        params.attachmentId,
        params.userId,
        params.xPercent,
        params.yPercent,
        params.page,
        params.content,
        params.requestApproval ?? false,
        params.requestChanges ?? false,
        params.taskId ?? null,
        params.parentId ?? null,
      ]
    );
    const pinId = pinRows[0].id;
    if (params.shapes && params.shapes.length > 0) {
      await insertShapesForPin(client, pinId, params.shapes);
    }
    await client.query("COMMIT");
    return (await getPinCommentById(pinId))!;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

/** Update resolved status of a pin comment. */
export async function updatePinComment(pinId: string, resolved: boolean) {
  const pool = getPool();
  await pool.query(`UPDATE pin_comment SET resolved = $1 WHERE id = $2`, [
    resolved,
    pinId,
  ]);
  return getPinCommentById(pinId);
}

/** Update content of a pin comment. */
export async function updatePinCommentContent(pinId: string, content: string) {
  const pool = getPool();
  await pool.query(
    `UPDATE pin_comment SET content = $1, updated_at = NOW() WHERE id = $2`,
    [content, pinId]
  );
  return getPinCommentById(pinId);
}

/** Update position of a pin comment. */
export async function updatePinCommentPosition(
  pinId: string,
  xPercent: number,
  yPercent: number,
  page: number
) {
  const pool = getPool();
  await pool.query(
    `UPDATE pin_comment SET x_percent = $1, y_percent = $2, page = $3 WHERE id = $4`,
    [xPercent, yPercent, page, pinId]
  );
  return getPinCommentById(pinId);
}

// ---------------------------------------------------------------------------
// Pin comment with task (transactional)
// ---------------------------------------------------------------------------

/**
 * Create a pin comment and an associated task in a single transaction.
 * Optionally rejects the attachment if request_changes is true.
 * Returns { pinId, taskId }.
 */
export async function createPinWithTask(params: {
  attachmentId: string;
  projectId: string;
  userId: string;
  xPercent: number | null;
  yPercent: number | null;
  page: number | null;
  content: string;
  requestChanges: boolean;
  assignedTo: string;
  dueDate: string | null;
  shapes?: ReadonlyArray<PinShape>;
}): Promise<{ pinId: string; taskId: string }> {
  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const { rows: projRows } = await client.query(
      `SELECT org_id FROM project WHERE id = $1`,
      [params.projectId]
    );
    if (!projRows[0]) {
      await client.query("ROLLBACK");
      throw new Error("Project not found");
    }
    const orgId = projRows[0].org_id;

    const taskTitle =
      params.content.length > 100
        ? params.content.slice(0, 97) + "..."
        : params.content;

    const { rows: taskRows } = await client.query(
      `INSERT INTO task (org_id, project_id, title, created_by, assigned_to, due_date, status, priority, category)
       VALUES ($1, $2, $3, $4, $5, $6, 'todo', 'medium', 'review')
       RETURNING id`,
      [
        orgId,
        params.projectId,
        taskTitle,
        params.userId,
        params.assignedTo,
        params.dueDate,
      ]
    );
    const taskId = taskRows[0].id;

    const { rows: pinRows } = await client.query(
      `INSERT INTO pin_comment (attachment_id, user_id, x_percent, y_percent, page, content, request_approval, request_changes, task_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING id`,
      [
        params.attachmentId,
        params.userId,
        params.xPercent,
        params.yPercent,
        params.page,
        params.content,
        false,
        params.requestChanges,
        taskId,
      ]
    );
    const pinId = pinRows[0].id;

    if (params.shapes && params.shapes.length > 0) {
      await insertShapesForPin(client, pinId, params.shapes);
    }

    if (params.requestChanges) {
      await client.query(
        `UPDATE attachment SET review_status = 'rejected', reviewed_by = $1 WHERE id = $2`,
        [params.userId, params.attachmentId]
      );
    }

    await client.query("COMMIT");
    return { pinId, taskId };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

/** Delete a pin comment by ID (cascades to replies and shape rows). */
export async function deletePinComment(pinId: string) {
  const pool = getPool();
  await pool.query(`DELETE FROM pin_comment WHERE id = $1`, [pinId]);
}
