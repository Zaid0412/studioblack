import { getPool } from "@/lib/db";
import { logAuditSafe, AUDIT_ACTIONS } from "@/lib/queries/audit";
import type { IssuePurpose } from "@/lib/validations";

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

export interface DrawingRevision {
  id: string;
  drawing_id: string;
  org_id: string;
  rev_number: number;
  attachment_id: string;
  issue_purpose: IssuePurpose;
  issued_by: string;
  issued_at: string;
  created_at: string;
  /** Present on reads (joined). */
  issuer_name?: string;
}

export type IssueRevisionResult =
  | { revision: DrawingRevision }
  | { revision: null; reason: "not_found" | "wrong_attachment" };

/**
 * Issue the next revision of a drawing. `rev_number` restarts per drawing
 * (Rev-00 = MAX+1 of none), same idiom as the per-group version counter. Runs
 * in one transaction that also points the drawing at the new revision and flips
 * its status to `issued`. Audit is logged after commit (fire-and-forget).
 */
export async function issueRevision(params: {
  drawingId: string;
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

    const { rows: drawingRows } = await client.query(
      `SELECT id FROM drawing WHERE id = $1 AND project_id = $2 FOR UPDATE`,
      [params.drawingId, params.projectId]
    );
    if (drawingRows.length === 0) {
      await client.query("ROLLBACK");
      return { revision: null, reason: "not_found" };
    }

    // The version being issued must belong to this drawing.
    const { rows: attRows } = await client.query(
      `SELECT id FROM attachment WHERE id = $1 AND drawing_id = $2`,
      [params.attachmentId, params.drawingId]
    );
    if (attRows.length === 0) {
      await client.query("ROLLBACK");
      return { revision: null, reason: "wrong_attachment" };
    }

    const { rows: nextRows } = await client.query<{ next: number }>(
      `SELECT COALESCE(MAX(rev_number), -1) + 1 AS next
         FROM drawing_revision WHERE drawing_id = $1`,
      [params.drawingId]
    );
    const revNumber = nextRows[0].next;

    const {
      rows: [revision],
    } = await client.query<DrawingRevision>(
      `INSERT INTO drawing_revision
         (drawing_id, org_id, rev_number, attachment_id, issue_purpose, issued_by)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        params.drawingId,
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
      [revision.id, params.drawingId]
    );

    await client.query("COMMIT");

    void logAuditSafe({
      orgId: params.orgId,
      actorId: params.userId,
      action: AUDIT_ACTIONS.DRAWING_REVISION_ISSUED,
      targetTable: "drawing",
      targetId: params.drawingId,
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
): Promise<DrawingRevision[]> {
  const pool = getPool();
  const { rows } = await pool.query<DrawingRevision>(
    `SELECT dr.*, u.name AS issuer_name
       FROM drawing_revision dr
       JOIN "user" u ON u.id = dr.issued_by
      WHERE dr.drawing_id = $1
      ORDER BY dr.rev_number DESC`,
    [drawingId]
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
