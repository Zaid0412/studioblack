import { getPool } from "@/lib/db";

/** Get attachments for a project/phase/task. */
export async function getAttachments(filters: {
  projectId: string;
  phaseId?: string;
  taskId?: string;
  all?: boolean;
  clientOnly?: boolean;
}) {
  const pool = getPool();
  // Use a CTE with DISTINCT ON to get the latest version per version_group,
  // then apply filters on top — avoids the correlated subquery.
  let whereClauses = `WHERE a.project_id = $1`;
  const params: string[] = [filters.projectId];

  // Clients can only see files explicitly sent to them
  if (filters.clientOnly) {
    whereClauses += ` AND a.sent_to_client_at IS NOT NULL`;
  }

  if (!filters.all) {
    if (filters.taskId) {
      whereClauses += ` AND a.task_id = $${params.length + 1}`;
      params.push(filters.taskId);
    } else if (filters.phaseId) {
      whereClauses += ` AND a.phase_id = $${params.length + 1} AND a.task_id IS NULL`;
      params.push(filters.phaseId);
    } else {
      whereClauses += ` AND a.phase_id IS NULL AND a.task_id IS NULL`;
    }
  }

  const query = `
    WITH latest AS (
      SELECT DISTINCT ON (a.version_group) a.*, u.name AS uploaded_by_name
      FROM attachment a
      JOIN "user" u ON u.id = a.uploaded_by
      ${whereClauses}
      ORDER BY a.version_group, a.version DESC
    )
    SELECT * FROM latest ORDER BY created_at DESC, id`;

  const { rows } = await pool.query(query, params);
  return rows;
}

/**
 * Per-phase attachment counts for a project — the lightweight companion to
 * `getAttachments({ all: true })`. The project layout's stepper/MetaBar only
 * needs a count per phase, so this avoids downloading every full row on every
 * non-Designs route. Counts the latest version per `version_group` (matching
 * `getAttachments`' `DISTINCT ON` shape) and honors the same `clientOnly`
 * visibility rule so client vs. team counts stay consistent.
 */
export async function getAttachmentPhaseCounts(filters: {
  projectId: string;
  clientOnly?: boolean;
}): Promise<{ phase_id: string; count: number }[]> {
  const pool = getPool();
  let where = `WHERE a.project_id = $1`;
  if (filters.clientOnly) {
    where += ` AND a.sent_to_client_at IS NOT NULL`;
  }
  const { rows } = await pool.query<{ phase_id: string; count: number }>(
    `WITH latest AS (
       SELECT DISTINCT ON (a.version_group) a.id, a.phase_id
       FROM attachment a
       ${where}
       ORDER BY a.version_group, a.version DESC
     )
     SELECT phase_id, COUNT(*)::int AS count
     FROM latest
     WHERE phase_id IS NOT NULL
     GROUP BY phase_id`,
    [filters.projectId]
  );
  return rows;
}

// ---------------------------------------------------------------------------
// Attachment queries (versioning + review)
// ---------------------------------------------------------------------------

/** Get attachments for a specific phase, with uploader info. */
export async function getAttachmentsByPhaseId(
  phaseId: string,
  projectId: string
) {
  const pool = getPool();
  const { rows } = await pool.query(
    `SELECT a.*, u.name AS uploaded_by_name, r.name AS reviewed_by_name
     FROM attachment a
     JOIN "user" u ON u.id = a.uploaded_by
     LEFT JOIN "user" r ON r.id = a.reviewed_by
     WHERE a.phase_id = $1 AND a.project_id = $2
     ORDER BY a.created_at DESC`,
    [phaseId, projectId]
  );
  return rows;
}

/** Get a single attachment by ID. */
export async function getAttachmentById(
  attachmentId: string,
  projectId: string
) {
  const pool = getPool();
  const {
    rows: [row],
  } = await pool.query(
    `SELECT a.*, u.name AS uploaded_by_name, r.name AS reviewed_by_name
     FROM attachment a
     JOIN "user" u ON u.id = a.uploaded_by
     LEFT JOIN "user" r ON r.id = a.reviewed_by
     WHERE a.id = $1 AND a.project_id = $2`,
    [attachmentId, projectId]
  );
  return row || null;
}

/** Delete a single attachment by ID (must belong to project). */
/** Delete an attachment. Only succeeds if the attachment is not frozen (TOCTOU-safe). */
export async function deleteAttachment(
  attachmentId: string,
  projectId: string
) {
  const pool = getPool();
  const { rowCount } = await pool.query(
    `DELETE FROM attachment WHERE id = $1 AND project_id = $2 AND frozen_at IS NULL`,
    [attachmentId, projectId]
  );
  return (rowCount ?? 0) > 0;
}

/** Get all versions of a file (by version_group), scoped to project. */
export async function getAttachmentVersionHistory(
  versionGroup: string,
  projectId: string,
  clientOnly?: boolean
) {
  const pool = getPool();
  let query = `SELECT a.*, u.name AS uploaded_by_name
     FROM attachment a
     JOIN "user" u ON u.id = a.uploaded_by
     WHERE a.version_group = $1 AND a.project_id = $2`;
  if (clientOnly) {
    query += ` AND a.sent_to_client_at IS NOT NULL`;
  }
  query += ` ORDER BY a.version DESC`;
  const { rows } = await pool.query(query, [versionGroup, projectId]);
  return rows;
}

/** Set or clear the frozen_at timestamp on an attachment (atomic, TOCTOU-safe). */
export async function setAttachmentFreezeStatus(
  attachmentId: string,
  projectId: string,
  freeze: boolean
) {
  const pool = getPool();
  const {
    rows: [updated],
  } = freeze
    ? await pool.query(
        `UPDATE attachment SET frozen_at = NOW()
         WHERE id = $1 AND project_id = $2 AND frozen_at IS NULL
         RETURNING id, file_name, file_url, frozen_at, review_status`,
        [attachmentId, projectId]
      )
    : await pool.query(
        `UPDATE attachment SET frozen_at = NULL
         WHERE id = $1 AND project_id = $2 AND frozen_at IS NOT NULL
         RETURNING id, file_name, file_url, frozen_at, review_status`,
        [attachmentId, projectId]
      );

  if (!updated) {
    // Distinguish not-found from already-in-target-state
    const { rows } = await pool.query(
      `SELECT id, frozen_at FROM attachment WHERE id = $1 AND project_id = $2`,
      [attachmentId, projectId]
    );
    if (rows.length === 0) return { error: "not_found" as const, data: null };
    return {
      error: (freeze ? "already_frozen" : "already_unfrozen") as
        | "already_frozen"
        | "already_unfrozen",
      data: null,
    };
  }
  return { error: null, data: updated };
}

/** Upload a new version of an existing file (same version_group, incremented version). */
export async function uploadNewVersion(
  versionGroup: string,
  fileUrl: string,
  fileName: string,
  uploadedBy: string,
  projectId: string,
  phaseId: string | null
) {
  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Lock version_group rows to prevent concurrent modifications
    const { rows: lockedRows } = await client.query(
      `SELECT id, frozen_at FROM attachment
       WHERE version_group = $1 AND project_id = $2
       FOR UPDATE`,
      [versionGroup, projectId]
    );

    // Block upload if any version in the group is frozen
    if (lockedRows.some((r) => r.frozen_at !== null)) {
      throw new Error(
        "Cannot upload a new version — this file is frozen after approval"
      );
    }

    // Get the current max version for this group
    const {
      rows: [{ max }],
    } = await client.query(
      `SELECT COALESCE(MAX(version), 0) AS max FROM attachment
       WHERE version_group = $1 AND project_id = $2`,
      [versionGroup, projectId]
    );
    const nextVersion = (max as number) + 1;

    const {
      rows: [row],
    } = await client.query(
      `INSERT INTO attachment (project_id, phase_id, uploaded_by, file_url, file_name, version, version_group)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        projectId,
        phaseId,
        uploadedBy,
        fileUrl,
        fileName,
        nextVersion,
        versionGroup,
      ]
    );

    await client.query("COMMIT");
    return row;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

/** Mark an attachment as sent to client. Returns null if already sent (TOCTOU-safe). */
export async function markAttachmentSentToClient(
  attachmentId: string,
  sentBy: string
) {
  const pool = getPool();
  const {
    rows: [updated],
  } = await pool.query(
    `UPDATE attachment
     SET sent_to_client_at = NOW(), sent_to_client_by = $1
     WHERE id = $2 AND sent_to_client_at IS NULL
     RETURNING *`,
    [sentBy, attachmentId]
  );
  return updated ?? null;
}

// ---------------------------------------------------------------------------
// Attachment mutations
// ---------------------------------------------------------------------------

/** Create a project attachment. */
export async function createProjectAttachment(params: {
  projectId: string;
  phaseId: string | null;
  taskId: string | null;
  uploadedBy: string;
  fileUrl: string;
  fileName: string;
  description: string;
}) {
  const pool = getPool();
  const {
    rows: [attachment],
  } = await pool.query(
    `INSERT INTO attachment (project_id, phase_id, task_id, uploaded_by, file_url, file_name, description)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [
      params.projectId,
      params.phaseId,
      params.taskId,
      params.uploadedBy,
      params.fileUrl,
      params.fileName,
      params.description,
    ]
  );
  return attachment;
}

/** Update attachment review_status. */
export async function updateAttachmentStatus(
  attachmentId: string,
  projectId: string,
  reviewStatus: "pending" | "approved" | "rejected" | "request_changes"
) {
  const pool = getPool();
  const {
    rows: [updated],
  } = await pool.query(
    `UPDATE attachment SET review_status = $1 WHERE id = $2 AND project_id = $3 RETURNING *`,
    [reviewStatus, attachmentId, projectId]
  );
  return updated;
}
