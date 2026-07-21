import { getPool } from "@/lib/db";
import { logAuditSafe, AUDIT_ACTIONS } from "@/lib/queries/audit";
import type { IssuePurpose } from "@/lib/validations";
import type { DbDrawingRevision } from "@/types";

/**
 * Drawing revisions (PRD "01.Design doc"), PR-3.
 *
 * A revision is an official issue of a drawing at a specific version — a
 * snapshot of one `attachment` row as Rev-NN with an issue purpose. Append-only:
 * previous revisions stay on the record and are read-only by construction.
 *
 * Revision read-only is NOT the whole-drawing design freeze (`frozen_at`): a
 * drawing can still take new versions for the next revision. The "issued
 * versions are read-only" rule is enforced by the `drawing_revision` reference
 * (see the delete / markup guards), leaving the upload freeze guard untouched.
 */

export type IssueRevisionResult =
  | { revision: DbDrawingRevision }
  | { revision: null; reason: "not_found" | "no_drawing" };

/**
 * Issue the next revision of the drawing that owns `attachmentId` — the version
 * being viewed in the review workspace. `rev_number` restarts per drawing
 * (Rev-00 = MAX+1 of none), same idiom as the per-group version counter. Runs
 * in one transaction that locks the drawing, snapshots the attachment as the
 * new revision, points the drawing at it, and flips its status to `issued`.
 * Audit is logged after commit (fire-and-forget).
 *
 * `not_found` — attachment isn't in this project; `no_drawing` — the attachment
 * is a task/loose file with no drawing to revise.
 */
export async function issueRevision(params: {
  attachmentId: string;
  projectId: string;
  orgId: string;
  userId: string;
  issuePurpose: IssuePurpose;
}): Promise<IssueRevisionResult> {
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const { rows: attRows } = await client.query<{ drawing_id: string | null }>(
      `SELECT drawing_id FROM attachment WHERE id = $1 AND project_id = $2`,
      [params.attachmentId, params.projectId]
    );
    if (attRows.length === 0) {
      await client.query("ROLLBACK");
      return { revision: null, reason: "not_found" };
    }
    const drawingId = attRows[0].drawing_id;
    if (!drawingId) {
      await client.query("ROLLBACK");
      return { revision: null, reason: "no_drawing" };
    }

    const { rows: drawingRows } = await client.query(
      `SELECT id FROM drawing WHERE id = $1 AND project_id = $2 FOR UPDATE`,
      [drawingId, params.projectId]
    );
    if (drawingRows.length === 0) {
      await client.query("ROLLBACK");
      return { revision: null, reason: "not_found" };
    }

    const { rows: nextRows } = await client.query<{ next: number }>(
      `SELECT COALESCE(MAX(rev_number), -1) + 1 AS next
         FROM drawing_revision WHERE drawing_id = $1`,
      [drawingId]
    );
    const revNumber = nextRows[0].next;

    const {
      rows: [revision],
    } = await client.query<DbDrawingRevision>(
      `INSERT INTO drawing_revision
         (drawing_id, org_id, rev_number, attachment_id, issue_purpose, issued_by)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        drawingId,
        params.orgId,
        revNumber,
        params.attachmentId,
        params.issuePurpose,
        params.userId,
      ]
    );

    await client.query(
      `UPDATE drawing
          SET current_revision_id = $1, status = 'issued', updated_at = now()
        WHERE id = $2`,
      [revision.id, drawingId]
    );

    await client.query("COMMIT");

    void logAuditSafe({
      orgId: params.orgId,
      actorId: params.userId,
      action: AUDIT_ACTIONS.DRAWING_REVISION_ISSUED,
      targetTable: "drawing",
      targetId: drawingId,
      metadata: {
        rev_number: revNumber,
        attachment_id: params.attachmentId,
        issue_purpose: params.issuePurpose,
      },
    });

    return { revision };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

/** Every revision of a drawing, newest first, with the issuer's name. */
export async function getDrawingRevisions(
  drawingId: string
): Promise<DbDrawingRevision[]> {
  const pool = getPool();
  const { rows } = await pool.query<DbDrawingRevision>(
    `SELECT dr.*, u.name AS issuer_name
       FROM drawing_revision dr
       JOIN "user" u ON u.id = dr.issued_by
      WHERE dr.drawing_id = $1
      ORDER BY dr.rev_number DESC`,
    [drawingId]
  );
  return rows;
}

/**
 * Revision history for the drawing an attachment belongs to — the review
 * workspace holds an attachment id, not a drawing id. Empty for loose files
 * (no drawing) or a drawing that's never been issued.
 */
export async function getRevisionsForAttachment(
  attachmentId: string,
  projectId: string
): Promise<DbDrawingRevision[]> {
  const pool = getPool();
  const { rows } = await pool.query<DbDrawingRevision>(
    `SELECT dr.*, u.name AS issuer_name
       FROM attachment a
       JOIN drawing_revision dr ON dr.drawing_id = a.drawing_id
       JOIN "user" u ON u.id = dr.issued_by
      WHERE a.id = $1 AND a.project_id = $2
      ORDER BY dr.rev_number DESC`,
    [attachmentId, projectId]
  );
  return rows;
}

/** True when an attachment version has been officially issued (→ read-only). */
export async function isAttachmentIssued(
  attachmentId: string
): Promise<boolean> {
  const pool = getPool();
  const { rows } = await pool.query(
    `SELECT 1 FROM drawing_revision WHERE attachment_id = $1 LIMIT 1`,
    [attachmentId]
  );
  return rows.length > 0;
}
