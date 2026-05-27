import { getPool } from "@/lib/db";
import type { DbProjectDocument, DbProjectDocumentSection } from "@/types";

// ---------------------------------------------------------------------------
// Default sections seeded on first visit so the page is never empty.
// Users can rename / re-icon / delete freely after seeding.
// ---------------------------------------------------------------------------
export const DEFAULT_DOCUMENT_SECTIONS = [
  { name: "Minutes of Meeting", icon: "Folder" },
  { name: "Gov Approvals", icon: "ShieldCheck" },
  { name: "Contracts", icon: "FileText" },
  { name: "Invoices", icon: "Receipt" },
  { name: "Permits", icon: "ClipboardList" },
  { name: "Other", icon: "Folder" },
] as const;

// ── Sections ────────────────────────────────────────────────────────────────

/**
 * List sections for a project with their document counts. If the project has
 * no sections yet, seeds the defaults first so the page always renders with
 * the standard categories.
 */
export async function listDocumentSections(
  projectId: string,
  createdBy: string
): Promise<DbProjectDocumentSection[]> {
  const pool = getPool();
  // LATERAL keeps the count subquery scoped per-row so we don't aggregate
  // across the whole table (and across all projects) just to look up counts
  // for one project's sections.
  const { rows: existing } = await pool.query<DbProjectDocumentSection>(
    `SELECT s.*, COALESCE(c.cnt, 0)::int AS doc_count
     FROM project_document_section s
     LEFT JOIN LATERAL (
       SELECT COUNT(*)::int AS cnt
       FROM project_document d
       WHERE d.section_id = s.id
     ) c ON true
     WHERE s.project_id = $1
     ORDER BY s.position ASC, s.created_at ASC`,
    [projectId]
  );
  if (existing.length > 0) return existing;

  // First-visit seed. INSERT … RETURNING is a single round-trip; doc_count
  // is known to be 0 for a fresh row so we synthesise it client-side.
  const values: string[] = [];
  const params: (string | number)[] = [];
  DEFAULT_DOCUMENT_SECTIONS.forEach((s, i) => {
    const off = i * 5;
    values.push(
      `($${off + 1}, $${off + 2}, $${off + 3}, $${off + 4}, $${off + 5})`
    );
    params.push(projectId, s.name, s.icon, i, createdBy);
  });
  const { rows } = await pool.query<DbProjectDocumentSection>(
    `INSERT INTO project_document_section (project_id, name, icon, position, created_by)
     VALUES ${values.join(", ")}
     RETURNING *, 0::int AS doc_count`,
    params
  );
  return rows;
}

/** Fetch a section by id, scoped to its project. Returns null when not found. */
export async function getDocumentSectionById(
  sectionId: string,
  projectId: string
): Promise<DbProjectDocumentSection | null> {
  const pool = getPool();
  const {
    rows: [row],
  } = await pool.query<DbProjectDocumentSection>(
    `SELECT s.*, 0::int AS doc_count
     FROM project_document_section s
     WHERE s.id = $1 AND s.project_id = $2`,
    [sectionId, projectId]
  );
  return row ?? null;
}

/** Create a new section, auto-assigning the next `position` slot. */
export async function createDocumentSection(args: {
  projectId: string;
  name: string;
  icon: string;
  createdBy: string;
}): Promise<DbProjectDocumentSection> {
  const pool = getPool();
  const {
    rows: [row],
  } = await pool.query<DbProjectDocumentSection>(
    `WITH next_pos AS (
       SELECT COALESCE(MAX(position), -1) + 1 AS p
       FROM project_document_section
       WHERE project_id = $1
     )
     INSERT INTO project_document_section (project_id, name, icon, position, created_by)
     VALUES ($1, $2, $3, (SELECT p FROM next_pos), $4)
     RETURNING *, 0::int AS doc_count`,
    [args.projectId, args.name, args.icon, args.createdBy]
  );
  return row;
}

/** Rename / re-icon / reorder a section. Only the supplied keys are updated. */
export async function updateDocumentSection(args: {
  sectionId: string;
  projectId: string;
  name?: string;
  icon?: string;
  position?: number;
}): Promise<DbProjectDocumentSection | null> {
  const pool = getPool();
  const sets: string[] = [];
  const params: (string | number)[] = [];
  if (args.name !== undefined) {
    params.push(args.name);
    sets.push(`name = $${params.length}`);
  }
  if (args.icon !== undefined) {
    params.push(args.icon);
    sets.push(`icon = $${params.length}`);
  }
  if (args.position !== undefined) {
    params.push(args.position);
    sets.push(`position = $${params.length}`);
  }
  if (sets.length === 0) {
    return getDocumentSectionById(args.sectionId, args.projectId);
  }
  sets.push(`updated_at = now()`);
  params.push(args.sectionId, args.projectId);
  const {
    rows: [row],
  } = await pool.query<DbProjectDocumentSection>(
    `UPDATE project_document_section
     SET ${sets.join(", ")}
     WHERE id = $${params.length - 1} AND project_id = $${params.length}
     RETURNING *, 0::int AS doc_count`,
    params
  );
  return row ?? null;
}

/**
 * Delete a section and return the storage paths of every document the
 * cascade just removed, so the caller can clean up the storage bucket in
 * the same round-trip. Returns `null` when the section didn't exist (or
 * didn't belong to the project) so callers can 404.
 */
export async function deleteDocumentSection(
  sectionId: string,
  projectId: string
): Promise<string[] | null> {
  const pool = getPool();
  const { rows } = await pool.query<{
    storage_paths: string[] | null;
    deleted: string | null;
  }>(
    `WITH paths AS (
       SELECT array_agg(storage_path) AS storage_paths
       FROM project_document
       WHERE section_id = $1 AND project_id = $2
     ),
     deleted AS (
       DELETE FROM project_document_section
       WHERE id = $1 AND project_id = $2
       RETURNING id
     )
     SELECT
       (SELECT storage_paths FROM paths) AS storage_paths,
       (SELECT id FROM deleted) AS deleted`,
    [sectionId, projectId]
  );
  if (!rows[0]?.deleted) return null;
  return rows[0].storage_paths ?? [];
}

// ── Documents ───────────────────────────────────────────────────────────────

/**
 * List every document in a project, with section + uploader info. Used by the
 * default "All documents" view in the Documents page.
 *
 * DISTINCT ON keeps only the latest row per `version_group` — older versions
 * exist in the table but are surfaced exclusively through the version history
 * endpoint.
 */
export async function listProjectDocuments(
  projectId: string
): Promise<DbProjectDocument[]> {
  const pool = getPool();
  const { rows } = await pool.query<DbProjectDocument>(
    `WITH latest AS (
       SELECT DISTINCT ON (version_group) *
       FROM project_document
       WHERE project_id = $1
       ORDER BY version_group, version DESC
     )
     SELECT latest.*, u.name AS uploaded_by_name, s.name AS section_name
     FROM latest
     LEFT JOIN "user" u ON u.id = latest.uploaded_by
     LEFT JOIN project_document_section s ON s.id = latest.section_id
     ORDER BY latest.created_at DESC`,
    [projectId]
  );
  return rows;
}

/** List the documents in a section, newest first (latest version per group). */
export async function listSectionDocuments(
  sectionId: string,
  projectId: string
): Promise<DbProjectDocument[]> {
  const pool = getPool();
  const { rows } = await pool.query<DbProjectDocument>(
    `WITH latest AS (
       SELECT DISTINCT ON (version_group) *
       FROM project_document
       WHERE section_id = $1 AND project_id = $2
       ORDER BY version_group, version DESC
     )
     SELECT latest.*, u.name AS uploaded_by_name
     FROM latest
     LEFT JOIN "user" u ON u.id = latest.uploaded_by
     ORDER BY latest.created_at DESC`,
    [sectionId, projectId]
  );
  return rows;
}

/** Fetch one document by id, scoped to its project. */
export async function getDocumentById(
  documentId: string,
  projectId: string
): Promise<DbProjectDocument | null> {
  const pool = getPool();
  const {
    rows: [row],
  } = await pool.query<DbProjectDocument>(
    `SELECT d.*, u.name AS uploaded_by_name
     FROM project_document d
     LEFT JOIN "user" u ON u.id = d.uploaded_by
     WHERE d.id = $1 AND d.project_id = $2`,
    [documentId, projectId]
  );
  return row ?? null;
}

/** Insert a new document row after the file is in storage. */
export async function createDocument(args: {
  projectId: string;
  sectionId: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  storagePath: string;
  uploadedBy: string;
  description?: string | null;
}): Promise<DbProjectDocument> {
  const pool = getPool();
  const {
    rows: [row],
  } = await pool.query<DbProjectDocument>(
    `INSERT INTO project_document
       (project_id, section_id, file_name, file_size, mime_type, storage_path, uploaded_by, description)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING *`,
    [
      args.projectId,
      args.sectionId,
      args.fileName,
      args.fileSize,
      args.mimeType,
      args.storagePath,
      args.uploadedBy,
      args.description ?? null,
    ]
  );
  return row;
}

/**
 * Update one or more of `file_name`, `description`, `section_id` on a
 * document. Empty-string descriptions are clamped to NULL so the DB doesn't
 * end up holding meaningless empty strings.
 *
 * Caller is expected to have verified that any `sectionId` belongs to the
 * same project (e.g. via `getDocumentSectionById`). Returns null when the
 * document doesn't exist or doesn't belong to the project.
 */
export async function updateDocument(args: {
  documentId: string;
  projectId: string;
  fileName?: string;
  description?: string | null;
  sectionId?: string;
}): Promise<DbProjectDocument | null> {
  const pool = getPool();
  const sets: string[] = [];
  const params: (string | null)[] = [];
  if (args.fileName !== undefined) {
    params.push(args.fileName);
    sets.push(`file_name = $${params.length}`);
  }
  if (args.description !== undefined) {
    params.push(args.description === "" ? null : args.description);
    sets.push(`description = $${params.length}`);
  }
  if (args.sectionId !== undefined) {
    params.push(args.sectionId);
    sets.push(`section_id = $${params.length}`);
  }
  if (sets.length === 0) {
    return getDocumentById(args.documentId, args.projectId);
  }
  params.push(args.documentId, args.projectId);
  const {
    rows: [row],
  } = await pool.query<DbProjectDocument>(
    `UPDATE project_document
     SET ${sets.join(", ")}
     WHERE id = $${params.length - 1} AND project_id = $${params.length}
     RETURNING *`,
    params
  );
  return row ?? null;
}

/**
 * Delete a document — every row in its `version_group` — and return the
 * distinct storage paths to clean up. Returns `null` when the document
 * didn't exist so callers can 404.
 */
export async function deleteDocument(
  documentId: string,
  projectId: string
): Promise<string[] | null> {
  const pool = getPool();
  const { rows } = await pool.query<{ storage_path: string }>(
    `WITH target AS (
       SELECT version_group FROM project_document
       WHERE id = $1 AND project_id = $2
     ),
     deleted AS (
       DELETE FROM project_document
       WHERE project_id = $2
         AND version_group = (SELECT version_group FROM target)
       RETURNING storage_path
     )
     SELECT DISTINCT storage_path FROM deleted`,
    [documentId, projectId]
  );
  if (rows.length === 0) return null;
  return rows.map((r) => r.storage_path);
}

// ── Version history ─────────────────────────────────────────────────────────

/**
 * Return every row in the version group that `documentId` belongs to, oldest
 * version first. The page's timeline renders chronologically, so the order
 * here matches the UI directly. Returns `null` when the document doesn't
 * exist (so callers can 404 without a separate getDocumentById round-trip).
 */
export async function getDocumentVersionHistory(
  documentId: string,
  projectId: string
): Promise<DbProjectDocument[] | null> {
  const pool = getPool();
  const { rows } = await pool.query<DbProjectDocument>(
    `SELECT d.*, u.name AS uploaded_by_name
     FROM project_document d
     LEFT JOIN "user" u ON u.id = d.uploaded_by
     WHERE d.project_id = $2
       AND d.version_group = (
         SELECT version_group FROM project_document
         WHERE id = $1 AND project_id = $2
       )
     ORDER BY d.version ASC`,
    [documentId, projectId]
  );
  return rows.length === 0 ? null : rows;
}

/** Resolve the highest `version` for a row's group. Null when the row's gone. */
export async function getLatestVersionForDocument(
  documentId: string,
  projectId: string
): Promise<{ versionGroup: string; latestVersion: number } | null> {
  const pool = getPool();
  const {
    rows: [row],
  } = await pool.query<{ version_group: string; max: number }>(
    `WITH target AS (
       SELECT version_group FROM project_document
       WHERE id = $1 AND project_id = $2
     )
     SELECT t.version_group,
            (SELECT MAX(version) FROM project_document
             WHERE version_group = t.version_group) AS max
     FROM target t`,
    [documentId, projectId]
  );
  if (!row) return null;
  return { versionGroup: row.version_group, latestVersion: row.max };
}

/**
 * Append a new version row. Resolves the version_group from any row in the
 * group, locks the current latest inside a transaction so concurrent uploads
 * can't race on `version`, then inserts at MAX+1 inheriting `section_id`.
 * Returns `null` when the document doesn't exist.
 */
export async function createDocumentVersion(args: {
  projectId: string;
  documentId: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  storagePath: string;
  uploadedBy: string;
  description?: string | null;
}): Promise<DbProjectDocument | null> {
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { rows: locked } = await client.query<{
      version_group: string;
      section_id: string;
      version: number;
    }>(
      `SELECT version_group, section_id, version FROM project_document
       WHERE project_id = $2
         AND version_group = (
           SELECT version_group FROM project_document
           WHERE id = $1 AND project_id = $2
         )
       ORDER BY version DESC
       LIMIT 1
       FOR UPDATE`,
      [args.documentId, args.projectId]
    );
    if (locked.length === 0) {
      await client.query("ROLLBACK");
      return null;
    }
    const {
      version_group: versionGroup,
      section_id: sectionId,
      version,
    } = locked[0];
    const {
      rows: [row],
    } = await client.query<DbProjectDocument>(
      `INSERT INTO project_document
         (project_id, section_id, file_name, file_size, mime_type,
          storage_path, uploaded_by, description, version, version_group)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [
        args.projectId,
        sectionId,
        args.fileName,
        args.fileSize,
        args.mimeType,
        args.storagePath,
        args.uploadedBy,
        args.description ?? null,
        version + 1,
        versionGroup,
      ]
    );
    await client.query("COMMIT");
    return row;
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

/**
 * "Revert to V{n}" — append a new row at MAX(version)+1 whose file fields are
 * copied from V{n}. Storage path is reused (no extra storage cost). Append-
 * only semantics keep the audit trail intact: V{n} stays exactly where it
 * was, and an explicit revert event sits at the top of the timeline.
 *
 * Returns:
 *   - the new row on success
 *   - `null` when the document doesn't exist
 *   - `"target_not_found"` when the document exists but no row in its group
 *     has the requested `targetVersion`
 */
export async function revertDocumentToVersion(args: {
  documentId: string;
  projectId: string;
  targetVersion: number;
  uploadedBy: string;
}): Promise<DbProjectDocument | null | "target_not_found"> {
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    // Resolve group first so we can distinguish "doc not found" (null) from
    // "doc exists but no such version" (target_not_found) — important for
    // accurate HTTP status codes upstream.
    const {
      rows: [groupRow],
    } = await client.query<{ version_group: string }>(
      `SELECT version_group FROM project_document
       WHERE id = $1 AND project_id = $2`,
      [args.documentId, args.projectId]
    );
    if (!groupRow) {
      await client.query("ROLLBACK");
      return null;
    }
    const { rows: locked } = await client.query<{
      section_id: string;
      file_name: string;
      file_size: number;
      mime_type: string;
      storage_path: string;
      description: string | null;
      group_max: number;
    }>(
      `SELECT section_id, file_name, file_size, mime_type, storage_path,
              description,
              MAX(version) OVER () AS group_max
       FROM project_document
       WHERE version_group = $1 AND project_id = $2 AND version = $3
       FOR UPDATE`,
      [groupRow.version_group, args.projectId, args.targetVersion]
    );
    if (locked.length === 0) {
      await client.query("ROLLBACK");
      return "target_not_found";
    }
    const target = locked[0];
    const {
      rows: [row],
    } = await client.query<DbProjectDocument>(
      `INSERT INTO project_document
         (project_id, section_id, file_name, file_size, mime_type,
          storage_path, uploaded_by, description, version, version_group)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [
        args.projectId,
        target.section_id,
        target.file_name,
        target.file_size,
        target.mime_type,
        target.storage_path,
        args.uploadedBy,
        target.description,
        target.group_max + 1,
        groupRow.version_group,
      ]
    );
    await client.query("COMMIT");
    return row;
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

/**
 * Delete a single version row inside a group. Returns:
 *   - `{ kind: "deleted", storagePathToRemove }` — the row was removed.
 *     `storagePathToRemove` is the storage object the caller should delete,
 *     or `null` when another row in the group still references that path
 *     (revert reuses storage). Callers don't need to know about revert
 *     internals — just delete the path when non-null.
 *   - `null` when the row didn't exist.
 *   - `"last_version"` when the group has only this row left — callers
 *     should fall back to `deleteDocument`.
 */
export async function deleteDocumentVersion(args: {
  versionId: string;
  projectId: string;
}): Promise<
  | { kind: "deleted"; storagePathToRemove: string | null }
  | null
  | "last_version"
> {
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const {
      rows: [target],
    } = await client.query<{
      version_group: string;
      storage_path: string;
      group_count: string;
    }>(
      `SELECT version_group, storage_path,
              COUNT(*) OVER (PARTITION BY version_group)::text AS group_count
       FROM project_document
       WHERE id = $1 AND project_id = $2
       FOR UPDATE`,
      [args.versionId, args.projectId]
    );
    if (!target) {
      await client.query("ROLLBACK");
      return null;
    }
    if (Number(target.group_count) <= 1) {
      await client.query("ROLLBACK");
      return "last_version";
    }
    const {
      rows: [{ ref_count: refCount }],
    } = await client.query<{ ref_count: string }>(
      `WITH del AS (
         DELETE FROM project_document WHERE id = $1 AND project_id = $2
       )
       SELECT COUNT(*)::text AS ref_count FROM project_document
       WHERE version_group = $3 AND project_id = $2 AND storage_path = $4`,
      [
        args.versionId,
        args.projectId,
        target.version_group,
        target.storage_path,
      ]
    );
    await client.query("COMMIT");
    return {
      kind: "deleted",
      storagePathToRemove: Number(refCount) > 0 ? null : target.storage_path,
    };
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}
