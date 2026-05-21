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
 */
export async function listProjectDocuments(
  projectId: string
): Promise<DbProjectDocument[]> {
  const pool = getPool();
  const { rows } = await pool.query<DbProjectDocument>(
    `SELECT d.*, u.name AS uploaded_by_name, s.name AS section_name
     FROM project_document d
     LEFT JOIN "user" u ON u.id = d.uploaded_by
     LEFT JOIN project_document_section s ON s.id = d.section_id
     WHERE d.project_id = $1
     ORDER BY d.created_at DESC`,
    [projectId]
  );
  return rows;
}

/** List the documents in a section, newest first. */
export async function listSectionDocuments(
  sectionId: string,
  projectId: string
): Promise<DbProjectDocument[]> {
  const pool = getPool();
  const { rows } = await pool.query<DbProjectDocument>(
    `SELECT d.*, u.name AS uploaded_by_name
     FROM project_document d
     LEFT JOIN "user" u ON u.id = d.uploaded_by
     WHERE d.section_id = $1 AND d.project_id = $2
     ORDER BY d.created_at DESC`,
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
}): Promise<DbProjectDocument> {
  const pool = getPool();
  const {
    rows: [row],
  } = await pool.query<DbProjectDocument>(
    `INSERT INTO project_document
       (project_id, section_id, file_name, file_size, mime_type, storage_path, uploaded_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [
      args.projectId,
      args.sectionId,
      args.fileName,
      args.fileSize,
      args.mimeType,
      args.storagePath,
      args.uploadedBy,
    ]
  );
  return row;
}

/**
 * Delete a document row and return its `storage_path` so the caller can
 * clean up the bucket in the same round-trip. Returns `null` when no row
 * matched (already deleted / wrong project) so callers can 404.
 */
export async function deleteDocument(
  documentId: string,
  projectId: string
): Promise<string | null> {
  const pool = getPool();
  const {
    rows: [row],
  } = await pool.query<{ storage_path: string }>(
    `DELETE FROM project_document
     WHERE id = $1 AND project_id = $2
     RETURNING storage_path`,
    [documentId, projectId]
  );
  return row?.storage_path ?? null;
}
