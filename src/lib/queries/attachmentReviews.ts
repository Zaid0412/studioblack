import { getPool } from "@/lib/db";

// ---------------------------------------------------------------------------
// Attachment reviews
// ---------------------------------------------------------------------------

/** Create a new review for an attachment (one review round). */
export async function createAttachmentReview(params: {
  attachmentId: string;
  reviewerId: string;
  status: "approved" | "rejected";
  comment: string;
  annotatedFileUrl: string | null;
  annotationCount: number;
}) {
  const pool = getPool();
  const {
    rows: [row],
  } = await pool.query(
    `INSERT INTO attachment_review
       (attachment_id, reviewer_id, status, comment, annotated_file_url, annotation_count)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [
      params.attachmentId,
      params.reviewerId,
      params.status,
      params.comment,
      params.annotatedFileUrl,
      params.annotationCount,
    ]
  );
  return row;
}

/** Get all reviews for an attachment, newest first. */
export async function getAttachmentReviews(attachmentId: string) {
  const pool = getPool();
  const { rows } = await pool.query(
    `SELECT r.*, u.name AS reviewer_name
     FROM attachment_review r
     JOIN "user" u ON u.id = r.reviewer_id
     WHERE r.attachment_id = $1
     ORDER BY r.created_at DESC`,
    [attachmentId]
  );
  return rows;
}

/** Get the latest review for an attachment. */
export async function getLatestAttachmentReview(attachmentId: string) {
  const pool = getPool();
  const {
    rows: [row],
  } = await pool.query(
    `SELECT r.*, u.name AS reviewer_name
     FROM attachment_review r
     JOIN "user" u ON u.id = r.reviewer_id
     WHERE r.attachment_id = $1
     ORDER BY r.created_at DESC
     LIMIT 1`,
    [attachmentId]
  );
  return row || null;
}

// ---------------------------------------------------------------------------
// Attachment review transaction
// ---------------------------------------------------------------------------

/**
 * Submit a review for an attachment (approve/reject) in a single transaction.
 * On approval: freezes the attachment.
 * On rejection: auto-creates a review task for the uploader.
 */
export async function submitAttachmentReview(
  attachmentId: string,
  projectId: string,
  userId: string,
  status: "approved" | "rejected",
  comment?: string
): Promise<{
  attachment: Record<string, unknown> | null;
  task?: Record<string, unknown>;
  conflict?: boolean;
}> {
  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const { rows } = await client.query(
      `UPDATE attachment
       SET review_status = $1, reviewed_by = $2
       WHERE id = $3 AND review_status != $1
       RETURNING *`,
      [status, userId, attachmentId]
    );
    if (rows.length === 0) {
      await client.query("ROLLBACK");
      return { attachment: null, conflict: true };
    }
    const attachment = rows[0];

    if (status === "approved") {
      const { rows: frozenRows } = await client.query(
        `UPDATE attachment SET frozen_at = NOW() WHERE id = $1 RETURNING frozen_at`,
        [attachmentId]
      );
      if (frozenRows[0]) {
        attachment.frozen_at = frozenRows[0].frozen_at;
      }
    }

    let task: Record<string, unknown> | undefined;
    if (status === "rejected") {
      const {
        rows: [project],
      } = await client.query(`SELECT org_id FROM project WHERE id = $1`, [
        projectId,
      ]);
      if (project) {
        const taskTitle = comment
          ? comment.slice(0, 100)
          : `Changes requested on "${attachment.file_name}"`;
        const { rows: taskRows } = await client.query(
          `INSERT INTO task (org_id, project_id, title, created_by, assigned_to, status, priority, category)
           VALUES ($1, $2, $3, $4, $5, 'todo', 'medium', 'review')
           RETURNING *`,
          [project.org_id, projectId, taskTitle, userId, attachment.uploaded_by]
        );
        task = taskRows[0];
      }
    }

    await client.query("COMMIT");
    return { attachment, task };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}
