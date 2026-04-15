import { getPool } from "@/lib/db";
import {
  PROJECT_PHASES,
  PROJECT_STEPS,
  DEFAULT_PAGE_LIMIT,
} from "@/lib/constants";

/** Escape SQL LIKE/ILIKE wildcards so user input is treated as literal text. */
function escapeSqlLike(str: string): string {
  return str.replace(/[\\%_]/g, (ch) => `\\${ch}`);
}

// ---------------------------------------------------------------------------
// Project CRUD
// ---------------------------------------------------------------------------

interface CreateProjectInput {
  name: string;
  clientName?: string;
  clientEmail?: string;
  category: string;
  deadline?: string;
  scope?: string;
  areaSqft?: number;
  estimationInr?: number;
  address?: string;
  city?: string;
  state?: string;
  /** Custom phase names. Falls back to PROJECT_PHASES if empty/omitted. */
  phases?: string[];
  orgId: string;
  createdBy: string;
  architectIds?: string[];
}

/** Create a project + 6 phases + 7 steps + member assignments in a single transaction. */
export async function createProjectWithPhases(input: CreateProjectInput) {
  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Auto-resolve client name from user table, or derive from email
    let clientName = input.clientName || null;
    if (!clientName && input.clientEmail) {
      const { rows } = await client.query(
        `SELECT name FROM "user" WHERE LOWER(email) = LOWER($1) LIMIT 1`,
        [input.clientEmail]
      );
      clientName = rows[0]?.name ?? input.clientEmail.split("@")[0];
    }

    // Insert project
    const {
      rows: [project],
    } = await client.query(
      `INSERT INTO project (name, client_name, client_email, category, deadline, scope, area_sqft, estimation_inr, address, city, state, org_id, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       RETURNING *`,
      [
        input.name,
        clientName,
        input.clientEmail || null,
        input.category,
        input.deadline || null,
        input.scope || null,
        input.areaSqft ?? null,
        input.estimationInr ?? null,
        input.address || null,
        input.city || null,
        input.state || null,
        input.orgId,
        input.createdBy,
      ]
    );

    // Insert 7 workflow steps (single multi-row INSERT)
    const { rows: stepRows } = await client.query(
      `INSERT INTO project_step (project_id, name, step_order)
       SELECT $1, unnest($2::text[]), generate_series(1, $3)
       RETURNING id`,
      [project.id, PROJECT_STEPS, PROJECT_STEPS.length]
    );
    const stepIds = stepRows.map((r: { id: string }) => r.id);

    // Insert phases (single multi-row INSERT)
    const designStepId = stepIds[1]; // "Design" is step index 1
    const phaseNames = input.phases?.length
      ? input.phases
      : [...PROJECT_PHASES];
    await client.query(
      `INSERT INTO project_phase (project_id, name, phase_order, step_id)
       SELECT $1, unnest($2::text[]), generate_series(1, $3), $4`,
      [project.id, phaseNames, phaseNames.length, designStepId]
    );

    // Assign architects (single multi-row INSERT)
    if (input.architectIds?.length) {
      await client.query(
        `INSERT INTO project_member (project_id, user_id, role)
         SELECT $1, unnest($2::text[]), 'architect'
         ON CONFLICT (project_id, user_id) DO NOTHING`,
        [project.id, input.architectIds]
      );
    }

    await client.query("COMMIT");
    return project;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

/** Get all projects for an org (PM/Architect dashboard). */
export async function getProjectsByOrgId(orgId: string) {
  const pool = getPool();
  const { rows } = await pool.query(
    `SELECT p.*,
            array_agg(DISTINCT pm.user_id) FILTER (WHERE pm.user_id IS NOT NULL) AS architect_ids
     FROM project p
     LEFT JOIN project_member pm ON pm.project_id = p.id
     WHERE p.org_id = $1 AND p.status != 'archived'
     GROUP BY p.id
     ORDER BY p.created_at DESC`,
    [orgId]
  );
  return rows;
}

/** Get projects assigned to a specific architect. */
export async function getProjectsByArchitectId(userId: string, orgId: string) {
  const pool = getPool();
  const { rows } = await pool.query(
    `SELECT p.*
     FROM project p
     JOIN project_member pm ON pm.project_id = p.id AND pm.user_id = $1
     WHERE p.org_id = $2 AND p.status != 'archived'
     ORDER BY p.created_at DESC`,
    [userId, orgId]
  );
  return rows;
}

/** Get projects where the client email matches (client portal). */
export async function getProjectsByClientEmail(email: string) {
  const pool = getPool();
  const { rows } = await pool.query(
    `SELECT * FROM project WHERE client_email = $1 AND status != 'archived' ORDER BY created_at DESC`,
    [email]
  );
  return rows;
}

/** Clear client_email/client_name on all projects assigned to a given email. */
export async function clearClientEmailByEmail(email: string) {
  const pool = getPool();
  const { rowCount } = await pool.query(
    `UPDATE project SET client_email = NULL, client_name = NULL WHERE client_email = $1 AND status != 'archived'`,
    [email]
  );
  return rowCount ?? 0;
}

/** Get a single project by ID with phases, members, and steps. */
export async function getProjectById(projectId: string) {
  const pool = getPool();
  const {
    rows: [project],
  } = await pool.query(`SELECT * FROM project WHERE id = $1`, [projectId]);
  if (!project) return null;

  const [{ rows: phases }, { rows: members }, { rows: steps }] =
    await Promise.all([
      pool.query(
        `SELECT * FROM project_phase WHERE project_id = $1 ORDER BY phase_order`,
        [projectId]
      ),
      pool.query(
        `SELECT pm.*, u.name, u.email FROM project_member pm
         JOIN "user" u ON u.id = pm.user_id
         WHERE pm.project_id = $1`,
        [projectId]
      ),
      pool.query(
        `SELECT * FROM project_step WHERE project_id = $1 ORDER BY step_order`,
        [projectId]
      ),
    ]);

  return { ...project, phases, members, steps };
}

/** Get tasks for a phase, scoped to a project for security. */
export async function getPhaseTasks(phaseId: string, projectId: string) {
  const pool = getPool();
  const { rows } = await pool.query(
    `SELECT t.*, u.name AS assigned_name
     FROM phase_task t
     JOIN project_phase pp ON pp.id = t.phase_id
     LEFT JOIN "user" u ON u.id = t.assigned_to
     WHERE t.phase_id = $1 AND pp.project_id = $2
     ORDER BY t.created_at`,
    [phaseId, projectId]
  );
  return rows;
}

/** Verify a phase belongs to a project. */
export async function verifyPhaseOwnership(
  phaseId: string,
  projectId: string
): Promise<boolean> {
  const pool = getPool();
  const { rows } = await pool.query(
    `SELECT 1 FROM project_phase WHERE id = $1 AND project_id = $2`,
    [phaseId, projectId]
  );
  return rows.length > 0;
}

/** Verify a task belongs to a project (via its phase). */
export async function verifyTaskOwnership(
  taskId: string,
  projectId: string
): Promise<boolean> {
  const pool = getPool();
  const { rows } = await pool.query(
    `SELECT 1 FROM phase_task t
     JOIN project_phase pp ON pp.id = t.phase_id
     WHERE t.id = $1 AND pp.project_id = $2`,
    [taskId, projectId]
  );
  return rows.length > 0;
}

/**
 * Verify that optional phaseId/taskId belong to the given project.
 * Returns an error string if verification fails, or undefined if OK.
 */
export async function verifyResourceOwnership(
  projectId: string,
  phaseId?: string | null,
  taskId?: string | null
): Promise<string | undefined> {
  if (phaseId) {
    const owned = await verifyPhaseOwnership(phaseId, projectId);
    if (!owned) return "Phase not found in this project";
  }
  if (taskId) {
    const owned = await verifyTaskOwnership(taskId, projectId);
    if (!owned) return "Task not found in this project";
  }
  return undefined;
}

/** Get comments for a project/phase/task. */
export async function getComments(filters: {
  projectId: string;
  phaseId?: string;
  taskId?: string;
}) {
  const pool = getPool();
  let query = `SELECT c.*, u.name AS user_name, u.role AS user_role
               FROM comment c JOIN "user" u ON u.id = c.user_id
               WHERE c.project_id = $1`;
  const params: string[] = [filters.projectId];

  if (filters.taskId) {
    query += ` AND c.task_id = $${params.length + 1}`;
    params.push(filters.taskId);
  } else if (filters.phaseId) {
    query += ` AND c.phase_id = $${params.length + 1} AND c.task_id IS NULL`;
    params.push(filters.phaseId);
  } else {
    query += ` AND c.phase_id IS NULL AND c.task_id IS NULL`;
  }

  query += ` ORDER BY c.created_at`;
  const { rows } = await pool.query(query, params);
  return rows;
}

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

/** Get tasks pending client review for a project. */
export async function getTasksPendingReview(projectId: string) {
  const pool = getPool();
  const { rows } = await pool.query(
    `SELECT t.*, pp.name AS phase_name, pp.phase_order, u.name AS assigned_name
     FROM phase_task t
     JOIN project_phase pp ON pp.id = t.phase_id
     LEFT JOIN "user" u ON u.id = t.assigned_to
     WHERE pp.project_id = $1
       AND t.requires_client_review = true
       AND t.review_status = 'pending_review'
     ORDER BY pp.phase_order, t.created_at`,
    [projectId]
  );
  return rows;
}

/** Get all tasks assigned to a specific user across all projects. */
export async function getTasksByAssignee(userId: string) {
  const pool = getPool();
  const { rows } = await pool.query(
    `SELECT t.*, pp.name AS phase_name, pp.phase_order,
            p.name AS project_name, p.id AS project_id
     FROM phase_task t
     JOIN project_phase pp ON pp.id = t.phase_id
     JOIN project p ON p.id = pp.project_id
     WHERE t.assigned_to = $1
     ORDER BY
       CASE WHEN t.status = 'pending' THEN 0
            WHEN t.status = 'in_progress' THEN 1
            ELSE 2 END,
       t.due_date NULLS LAST,
       t.created_at DESC`,
    [userId]
  );
  return rows;
}

// ---------------------------------------------------------------------------
// Workflow Steps
// ---------------------------------------------------------------------------

/** Get workflow steps for a project. */
export async function getProjectSteps(projectId: string) {
  const pool = getPool();
  const { rows } = await pool.query(
    `SELECT * FROM project_step WHERE project_id = $1 ORDER BY step_order`,
    [projectId]
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

/** Update the review status of an attachment. */
/** Set or clear the frozen_at timestamp on an attachment. */
export async function setAttachmentFreezeStatus(
  attachmentId: string,
  projectId: string,
  freeze: boolean
) {
  const attachment = await getAttachmentById(attachmentId, projectId);
  if (!attachment) return { error: "not_found" as const, data: null };

  if (freeze && attachment.frozen_at) {
    return { error: "already_frozen" as const, data: null };
  }
  if (!freeze && !attachment.frozen_at) {
    return { error: "already_unfrozen" as const, data: null };
  }

  const pool = getPool();
  const {
    rows: [updated],
  } = await pool.query(
    `UPDATE attachment SET frozen_at = CASE WHEN $2 THEN NOW() ELSE NULL END WHERE id = $1 RETURNING id, file_name, file_url, frozen_at, review_status`,
    [attachmentId, freeze]
  );
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
// Access control
// ---------------------------------------------------------------------------

/** Get a user's role within an organization (owner/admin/member or null). */
export async function getMemberRole(
  orgId: string,
  userId: string
): Promise<string | null> {
  const pool = getPool();
  const { rows } = await pool.query(
    `SELECT role FROM member WHERE "organizationId" = $1 AND "userId" = $2`,
    [orgId, userId]
  );
  return rows[0]?.role ?? null;
}

/** Get a user's org role for a project (owner/admin/member or null). */
export async function getOrgRole(
  projectId: string,
  userId: string
): Promise<string | null> {
  const pool = getPool();
  const { rows } = await pool.query(
    `SELECT m.role FROM project p
     JOIN member m ON m."organizationId" = p.org_id AND m."userId" = $2
     WHERE p.id = $1`,
    [projectId, userId]
  );
  return rows[0]?.role ?? null;
}

/** Check if a user has access to a project (org member or client). */
export async function hasProjectAccess(
  projectId: string,
  userId: string,
  userEmail: string | null | undefined,
  userRole: string | null | undefined
): Promise<boolean> {
  const pool = getPool();

  if (userRole === "client") {
    const { rows } = await pool.query(
      `SELECT 1 FROM project WHERE id = $1 AND client_email = $2`,
      [projectId, userEmail]
    );
    return rows.length > 0;
  }

  // PM/Architect — check org membership (they can see all org projects)
  // Note: better-auth member table uses camelCase columns
  const { rows } = await pool.query(
    `SELECT 1 FROM project p
     JOIN member m ON m."organizationId" = p.org_id AND m."userId" = $2
     WHERE p.id = $1`,
    [projectId, userId]
  );
  return rows.length > 0;
}

// ---------------------------------------------------------------------------
// Task Manager
// ---------------------------------------------------------------------------

/** Check that a task exists and belongs to the given org. */
export async function verifyTaskAccess(
  taskId: string,
  orgId: string | null
): Promise<boolean> {
  const pool = getPool();
  const { rows } = await pool.query(
    `SELECT id FROM task WHERE id = $1 AND ($2::text IS NULL OR org_id = $2)`,
    [taskId, orgId]
  );
  return rows.length > 0;
}

interface TaskFilters {
  orgId: string;
  bucket?:
    | "all"
    | "my_tasks"
    | "created_by_me"
    | "starred"
    | "upcoming"
    | "completed";
  userId: string;
  /** When true, all buckets are scoped to tasks assigned to the user. */
  assigneeOnly?: boolean;
  projectId?: string;
  status?: string;
  priority?: string;
  category?: string;
  phaseId?: string;
  search?: string;
  page?: number;
  limit?: number;
}

/** Fetch tasks with bucket-based filtering and optional search/status/priority/category filters. */
export async function getTasks(filters: TaskFilters) {
  const pool = getPool();
  const conditions: string[] = ["t.org_id = $1"];
  const values: unknown[] = [filters.orgId];
  let idx = 2;

  // Bucket filters
  switch (filters.bucket) {
    case "my_tasks":
      conditions.push(`t.assigned_to = $${idx}`);
      values.push(filters.userId);
      idx++;
      break;
    case "created_by_me":
      conditions.push(
        `t.created_by = $${idx} AND (t.assigned_to IS NULL OR t.assigned_to != $${idx})`
      );
      values.push(filters.userId);
      idx++;
      break;
    case "starred":
      conditions.push(
        `EXISTS (SELECT 1 FROM task_star ts WHERE ts.task_id = t.id AND ts.user_id = $${idx})`
      );
      values.push(filters.userId);
      idx++;
      break;
    case "upcoming":
      conditions.push(
        `t.due_date IS NOT NULL AND t.status != 'completed' AND t.status != 'archived'`
      );
      break;
    case "completed":
      conditions.push(`t.status = 'completed'`);
      break;
    default:
      // "all" — exclude archived
      conditions.push(`t.status != 'archived'`);
  }

  // Architects can only see tasks assigned to them
  if (filters.assigneeOnly) {
    conditions.push(`t.assigned_to = $${idx}`);
    values.push(filters.userId);
    idx++;
  }

  // Additional filters
  if (filters.projectId) {
    conditions.push(`t.project_id = $${idx}`);
    values.push(filters.projectId);
    idx++;
  }
  if (filters.status) {
    conditions.push(`t.status = $${idx}`);
    values.push(filters.status);
    idx++;
  }
  if (filters.priority) {
    conditions.push(`t.priority = $${idx}`);
    values.push(filters.priority);
    idx++;
  }
  if (filters.category) {
    conditions.push(`t.category = $${idx}`);
    values.push(filters.category);
    idx++;
  }
  if (filters.phaseId) {
    conditions.push(`(t.phase_id = $${idx} OR t.phase_id IS NULL)`);
    values.push(filters.phaseId);
    idx++;
  }
  if (filters.search) {
    const safeSearch = escapeSqlLike(filters.search.slice(0, 200));
    conditions.push(`(t.title ILIKE $${idx} OR t.description ILIKE $${idx})`);
    values.push(`%${safeSearch}%`);
    idx++;
  }

  // Add userId param for is_starred subquery
  values.push(filters.userId);
  const starIdx = idx;
  idx++;

  // Pagination params
  const page = filters.page ?? 1;
  const limit = filters.limit ?? DEFAULT_PAGE_LIMIT;
  const offset = (page - 1) * limit;

  values.push(limit);
  const limitIdx = idx;
  idx++;

  values.push(offset);
  const offsetIdx = idx;
  idx++;

  const { rows } = await pool.query(
    `SELECT t.*,
            u_assigned.name AS assigned_to_name,
            u_created.name AS created_by_name,
            p.name AS project_name,
            pp.name AS phase_name,
            EXISTS (SELECT 1 FROM task_star ts WHERE ts.task_id = t.id AND ts.user_id = $${starIdx}) AS is_starred,
            COALESCE(cl.total, 0)::int AS checklist_total,
            COALESCE(cl.done, 0)::int AS checklist_done,
            pc.id AS pin_comment_id,
            pc.attachment_id AS pin_attachment_id,
            COUNT(*) OVER()::int AS _total_count
     FROM task t
     LEFT JOIN "user" u_assigned ON u_assigned.id = t.assigned_to
     LEFT JOIN "user" u_created ON u_created.id = t.created_by
     LEFT JOIN project p ON p.id = t.project_id
     LEFT JOIN project_phase pp ON pp.id = t.phase_id
     LEFT JOIN (
       SELECT task_id, COUNT(*)::int AS total, COUNT(*) FILTER (WHERE is_done)::int AS done
       FROM task_checklist_item GROUP BY task_id
     ) cl ON cl.task_id = t.id
     LEFT JOIN LATERAL (
       SELECT id, attachment_id FROM pin_comment WHERE task_id = t.id LIMIT 1
     ) pc ON true
     WHERE ${conditions.join(" AND ")}
     ORDER BY
       t.created_at DESC
     LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
    values
  );

  const total = rows.length > 0 ? rows[0]._total_count : 0;
  // Strip the internal _total_count field from results
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const tasks = rows.map(({ _total_count, ...rest }) => rest);

  return { tasks, total };
}

/** Fetch a single task by ID with joined user, project, and phase names. */
export async function getTaskById(
  taskId: string,
  opts?: { userId?: string; orgId?: string }
) {
  const pool = getPool();
  const userId = opts?.userId;
  const orgId = opts?.orgId;

  const conditions: string[] = ["t.id = $1"];
  const params: unknown[] = [taskId];
  let idx = 2;

  if (orgId) {
    conditions.push(`t.org_id = $${idx}`);
    params.push(orgId);
    idx++;
  }

  const starClause = userId
    ? `EXISTS (SELECT 1 FROM task_star ts WHERE ts.task_id = t.id AND ts.user_id = $${idx})`
    : `false`;
  if (userId) {
    params.push(userId);
    idx++;
  }

  const { rows } = await pool.query(
    `SELECT t.*,
            u_assigned.name AS assigned_to_name,
            u_created.name AS created_by_name,
            p.name AS project_name,
            pp.name AS phase_name,
            ${starClause} AS is_starred,
            COALESCE(cl.total, 0)::int AS checklist_total,
            COALESCE(cl.done, 0)::int AS checklist_done,
            pc.id AS pin_comment_id,
            pc.attachment_id AS pin_attachment_id
     FROM task t
     LEFT JOIN "user" u_assigned ON u_assigned.id = t.assigned_to
     LEFT JOIN "user" u_created ON u_created.id = t.created_by
     LEFT JOIN project p ON p.id = t.project_id
     LEFT JOIN project_phase pp ON pp.id = t.phase_id
     LEFT JOIN (
       SELECT task_id, COUNT(*)::int AS total, COUNT(*) FILTER (WHERE is_done)::int AS done
       FROM task_checklist_item GROUP BY task_id
     ) cl ON cl.task_id = t.id
     LEFT JOIN LATERAL (
       SELECT id, attachment_id FROM pin_comment WHERE task_id = t.id LIMIT 1
     ) pc ON true
     WHERE ${conditions.join(" AND ")}`,
    params
  );
  return rows[0] || null;
}

/** Get task counts for each smart bucket in a single query. */
export async function getTaskBucketCounts(
  orgId: string,
  userId: string,
  assigneeOnly?: boolean
) {
  const pool = getPool();
  const assigneeFilter = assigneeOnly ? " AND t.assigned_to = $2" : "";
  const { rows } = await pool.query(
    `SELECT
       COUNT(*) FILTER (WHERE t.status != 'archived')::int AS all,
       COUNT(*) FILTER (WHERE t.assigned_to = $2 AND t.status != 'archived')::int AS my_tasks,
       COUNT(*) FILTER (WHERE t.created_by = $2 AND (t.assigned_to IS NULL OR t.assigned_to != $2) AND t.status != 'archived')::int AS created_by_me,
       COUNT(*) FILTER (WHERE ts.task_id IS NOT NULL AND t.status != 'archived'${assigneeFilter})::int AS starred,
       COUNT(*) FILTER (WHERE t.due_date IS NOT NULL AND t.status NOT IN ('completed', 'archived')${assigneeFilter})::int AS upcoming,
       COUNT(*) FILTER (WHERE t.status = 'completed'${assigneeFilter})::int AS completed
     FROM task t
     LEFT JOIN task_star ts ON ts.task_id = t.id AND ts.user_id = $2
     WHERE t.org_id = $1${assigneeFilter}`,
    [orgId, userId]
  );
  return rows[0];
}

// ── Pin Comments ─────────────────────────────────

/** Fetch top-level pin comments (no replies) for an attachment. */
export async function getPinComments(attachmentId: string) {
  const pool = getPool();
  const { rows } = await pool.query(
    `SELECT pc.*, u.name AS user_name,
            (SELECT COUNT(*) FROM pin_comment r WHERE r.parent_id = pc.id)::int AS reply_count
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
    `SELECT pc.*, u.name AS user_name, 0 AS reply_count
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
    `SELECT pc.*, u.name AS user_name,
            (SELECT COUNT(*) FROM pin_comment r WHERE r.parent_id = pc.id)::int AS reply_count
     FROM pin_comment pc
     JOIN "user" u ON u.id = pc.user_id
     WHERE pc.id = $1`,
    [pinId]
  );
  return rows[0] || null;
}

/** Insert a new pin comment (or reply) and return the created row. */
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
}) {
  const pool = getPool();
  const { rows } = await pool.query(
    `WITH inserted AS (
       INSERT INTO pin_comment (attachment_id, user_id, x_percent, y_percent, page, content, request_approval, request_changes, task_id, parent_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *
     )
     SELECT i.*, u.name AS user_name, 0::int AS reply_count
     FROM inserted i
     JOIN "user" u ON u.id = i.user_id`,
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
  return rows[0];
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
       RETURNING *`,
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

    if (params.requestChanges) {
      await client.query(
        `UPDATE attachment SET review_status = 'rejected', reviewed_by = $1 WHERE id = $2`,
        [params.userId, params.attachmentId]
      );
    }

    await client.query("COMMIT");
    return { pinId: pinRows[0].id, taskId };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

/** Delete a pin comment by ID (cascades to replies). */
export async function deletePinComment(pinId: string) {
  const pool = getPool();
  await pool.query(`DELETE FROM pin_comment WHERE id = $1`, [pinId]);
}

// ---------------------------------------------------------------------------
// Notifications
// ---------------------------------------------------------------------------

/** Get unread notification count for a user. */
export async function getUnreadNotificationCount(userId: string) {
  const pool = getPool();
  const { rows } = await pool.query(
    `SELECT COUNT(*)::int AS count FROM notification WHERE user_id = $1 AND read = false`,
    [userId]
  );
  return rows[0].count as number;
}

/** Get notifications for a user (most recent 50), with project name. */
export async function getNotifications(userId: string) {
  const pool = getPool();
  const { rows } = await pool.query(
    `SELECT n.*, p.name AS project_name
     FROM notification n
     LEFT JOIN project p ON p.id = n.project_id
     WHERE n.user_id = $1
     ORDER BY n.created_at DESC
     LIMIT 50`,
    [userId]
  );
  return rows;
}

/** Get recent notifications for a user (dashboard activity feed). */
export async function getRecentActivity(userId: string, limit = 10) {
  const pool = getPool();
  const { rows } = await pool.query(
    `SELECT n.id, n.type, n.title, n.description, n.created_at, p.name AS project_name
     FROM notification n
     LEFT JOIN project p ON p.id = n.project_id
     WHERE n.user_id = $1
     ORDER BY n.created_at DESC
     LIMIT $2`,
    [userId, limit]
  );
  return rows;
}

/** Mark all unread notifications as read for a user. */
export async function markAllNotificationsRead(userId: string) {
  const pool = getPool();
  await pool.query(
    `UPDATE notification SET read = true WHERE user_id = $1 AND read = false`,
    [userId]
  );
}

/** Mark specific notifications as read by IDs. */
export async function markNotificationsReadByIds(
  userId: string,
  ids: string[]
) {
  const pool = getPool();
  await pool.query(
    `UPDATE notification SET read = true WHERE user_id = $1 AND id = ANY($2::uuid[])`,
    [userId, ids]
  );
}

/** Delete a single notification by ID. */
export async function deleteNotification(userId: string, id: string) {
  const pool = getPool();
  await pool.query(`DELETE FROM notification WHERE user_id = $1 AND id = $2`, [
    userId,
    id,
  ]);
}

/** Delete all notifications for a user. */
export async function deleteAllNotifications(userId: string) {
  const pool = getPool();
  await pool.query(`DELETE FROM notification WHERE user_id = $1`, [userId]);
}

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------

/** Get dashboard stats (active projects, reviews, team members, upcoming deadlines). */
export async function getDashboardStats(orgId: string) {
  const pool = getPool();
  const { rows } = await pool.query(
    `WITH project_stats AS (
      SELECT
        COUNT(*) FILTER (WHERE status = 'active')::int AS active,
        COUNT(*) FILTER (WHERE status = 'completed')::int AS completed
      FROM project WHERE org_id = $1
    ),
    review_stats AS (
      SELECT
        COUNT(*) FILTER (WHERE a.review_status = 'pending')::int AS pending,
        COUNT(*) FILTER (WHERE a.review_status = 'approved')::int AS approved
      FROM attachment a
      JOIN project p ON p.id = a.project_id
      WHERE p.org_id = $1
    ),
    member_count AS (
      SELECT COUNT(*)::int AS count FROM member WHERE "organizationId" = $1
    ),
    upcoming AS (
      SELECT json_agg(row_to_json(d)) AS rows FROM (
        SELECT id, name, client_name, deadline, status
        FROM project
        WHERE org_id = $1 AND status = 'active' AND deadline IS NOT NULL
        ORDER BY deadline ASC
        LIMIT 5
      ) d
    )
    SELECT
      ps.active, ps.completed,
      rs.pending, rs.approved,
      mc.count AS team_members,
      u.rows AS deadlines
    FROM project_stats ps, review_stats rs, member_count mc, upcoming u`,
    [orgId]
  );
  return rows[0];
}

// ---------------------------------------------------------------------------
// Task Attachments (standalone tasks)
// ---------------------------------------------------------------------------

/** Get attachments for a standalone task. */
export async function getTaskAttachments(taskId: string) {
  const pool = getPool();
  const { rows } = await pool.query(
    `SELECT * FROM attachment WHERE standalone_task_id = $1 ORDER BY created_at DESC`,
    [taskId]
  );
  return rows;
}

/** Get a task's project_id. */
export async function getTaskProjectId(taskId: string): Promise<string | null> {
  const pool = getPool();
  const {
    rows: [row],
  } = await pool.query(`SELECT project_id FROM task WHERE id = $1`, [taskId]);
  return row?.project_id ?? null;
}

/** Get a task's org_id. */
export async function getTaskOrgId(taskId: string): Promise<string | null> {
  const pool = getPool();
  const {
    rows: [row],
  } = await pool.query(`SELECT org_id FROM task WHERE id = $1`, [taskId]);
  return row?.org_id ?? null;
}

/** Create an attachment for a standalone task. */
export async function createTaskAttachment(params: {
  taskId: string;
  projectId: string | null;
  uploadedBy: string;
  fileUrl: string;
  fileName: string;
  fileSize?: number | null;
}) {
  const pool = getPool();
  const {
    rows: [attachment],
  } = await pool.query(
    `INSERT INTO attachment (standalone_task_id, project_id, uploaded_by, file_url, file_name, file_size)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [
      params.taskId,
      params.projectId,
      params.uploadedBy,
      params.fileUrl,
      params.fileName,
      params.fileSize ?? null,
    ]
  );
  return attachment;
}

/** Get a standalone task attachment by ID and task ID. */
export async function getStandaloneTaskAttachment(
  attachmentId: string,
  taskId: string
) {
  const pool = getPool();
  const { rows } = await pool.query(
    `SELECT id, uploaded_by FROM attachment WHERE id = $1 AND standalone_task_id = $2`,
    [attachmentId, taskId]
  );
  return rows[0] || null;
}

/** Delete an attachment by ID. */
export async function deleteAttachmentById(attachmentId: string) {
  const pool = getPool();
  await pool.query(`DELETE FROM attachment WHERE id = $1`, [attachmentId]);
}

// ---------------------------------------------------------------------------
// Task Star (toggle)
// ---------------------------------------------------------------------------

/** Toggle star on a task for a user. Returns { starred: boolean }. */
export async function toggleTaskStar(
  userId: string,
  taskId: string
): Promise<{ starred: boolean }> {
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { rowCount } = await client.query(
      "DELETE FROM task_star WHERE user_id = $1 AND task_id = $2",
      [userId, taskId]
    );
    if (rowCount === 0) {
      await client.query(
        "INSERT INTO task_star (user_id, task_id) VALUES ($1, $2)",
        [userId, taskId]
      );
      await client.query("COMMIT");
      return { starred: true };
    }
    await client.query("COMMIT");
    return { starred: false };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

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

// ---------------------------------------------------------------------------
// Validation helpers
// ---------------------------------------------------------------------------

/** Validate that a user belongs to an organization. */
export async function validateOrgMembership(
  orgId: string,
  userId: string
): Promise<boolean> {
  const pool = getPool();
  const { rows } = await pool.query(
    'SELECT 1 FROM member WHERE "organizationId" = $1 AND "userId" = $2',
    [orgId, userId]
  );
  return rows.length > 0;
}

/** Validate that a project belongs to an organization. */
export async function validateProjectInOrg(
  projectId: string,
  orgId: string
): Promise<boolean> {
  const pool = getPool();
  const { rows } = await pool.query(
    "SELECT 1 FROM project WHERE id = $1 AND org_id = $2",
    [projectId, orgId]
  );
  return rows.length > 0;
}

/** Get a user's email and name by ID. */
export async function getUserEmailAndName(userId: string) {
  const pool = getPool();
  const {
    rows: [row],
  } = await pool.query(`SELECT u.email, u.name FROM "user" u WHERE u.id = $1`, [
    userId,
  ]);
  return row || null;
}

/** Get users by IDs (id, email, name). */
export async function getUsersByIds(userIds: string[]) {
  const pool = getPool();
  const { rows } = await pool.query(
    `SELECT id, email, name FROM "user" WHERE id = ANY($1::uuid[])`,
    [userIds]
  );
  return rows;
}

/** Check if a user exists by email. Returns { id } or null. */
export async function checkUserExistsByEmail(email: string): Promise<boolean> {
  const pool = getPool();
  const { rows } = await pool.query(
    `SELECT id FROM "user" WHERE email = $1 LIMIT 1`,
    [email]
  );
  return rows.length > 0;
}

// ---------------------------------------------------------------------------
// Task CRUD (standalone tasks)
// ---------------------------------------------------------------------------

/** Create a standalone task. */
export async function createTask(params: {
  orgId: string;
  projectId: string | null;
  phaseId: string | null;
  title: string;
  description: string;
  priority: string;
  category: string;
  createdBy: string;
  assignedTo: string;
  dueDate: string | null;
}) {
  const pool = getPool();
  const {
    rows: [task],
  } = await pool.query(
    `INSERT INTO task (org_id, project_id, phase_id, title, description, priority, category, created_by, assigned_to, due_date)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     RETURNING *`,
    [
      params.orgId,
      params.projectId,
      params.phaseId,
      params.title,
      params.description,
      params.priority,
      params.category,
      params.createdBy,
      params.assignedTo,
      params.dueDate,
    ]
  );
  return task;
}

/** Update a standalone task with dynamic fields. */
const TASK_COLS = new Set([
  "title",
  "description",
  "status",
  "priority",
  "category",
  "assigned_to",
  "project_id",
  "phase_id",
  "due_date",
  "reminder_at",
]);

export async function updateTask(
  taskId: string,
  fields: Record<string, unknown>,
  opts?: { completedAtTransition?: "set" | "clear" }
) {
  const updates: string[] = [];
  const values: unknown[] = [];
  let idx = 1;

  for (const [col, value] of Object.entries(fields)) {
    if (value !== undefined && TASK_COLS.has(col)) {
      updates.push(`"${col}" = $${idx}`);
      values.push(value === "" ? null : value);
      idx++;
    }
  }

  if (opts?.completedAtTransition === "set") {
    updates.push(`completed_at = now()`);
  } else if (opts?.completedAtTransition === "clear") {
    updates.push(`completed_at = NULL`);
  }

  if (updates.length === 0) return null;

  updates.push(`updated_at = now()`);
  values.push(taskId);

  const pool = getPool();
  const {
    rows: [updated],
  } = await pool.query(
    `UPDATE task SET ${updates.join(", ")} WHERE id = $${idx} RETURNING *`,
    values
  );
  return updated;
}

/** Delete a standalone task by ID. */
export async function deleteTask(taskId: string) {
  const pool = getPool();
  await pool.query(`DELETE FROM task WHERE id = $1`, [taskId]);
}

// ---------------------------------------------------------------------------
// Project mutations
// ---------------------------------------------------------------------------

const PROJECT_COLS = new Set([
  "name",
  "client_name",
  "client_email",
  "category",
  "status",
  "deadline",
  "scope",
  "area_sqft",
  "estimation_inr",
  "address",
  "city",
  "state",
]);

/** Update a project with dynamic fields + optional architect sync (transactional). */
export async function updateProject(
  projectId: string,
  fields: Record<string, unknown>,
  architectIds?: string[]
) {
  const updates: string[] = [];
  const values: unknown[] = [];
  let idx = 1;

  for (const [col, value] of Object.entries(fields)) {
    if (!PROJECT_COLS.has(col)) continue;
    updates.push(`"${col}" = $${idx}`);
    values.push(value);
    idx++;
  }

  if (updates.length === 0 && !architectIds) return null;

  updates.push(`updated_at = now()`);
  values.push(projectId);

  const pool = getPool();

  if (architectIds !== undefined) {
    // Transaction: update project + sync architects
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      let updated;
      if (updates.length > 1) {
        // > 1 because updated_at is always there
        const {
          rows: [row],
        } = await client.query(
          `UPDATE project SET ${updates.join(", ")} WHERE id = $${idx} RETURNING *`,
          values
        );
        updated = row;
      } else {
        const {
          rows: [row],
        } = await client.query(`SELECT * FROM project WHERE id = $1`, [
          projectId,
        ]);
        updated = row;
      }

      await client.query(
        `DELETE FROM project_member WHERE project_id = $1 AND role = 'architect'`,
        [projectId]
      );
      if (architectIds.length > 0) {
        await client.query(
          `INSERT INTO project_member (project_id, user_id, role)
           SELECT $1, unnest($2::text[]), 'architect'
           ON CONFLICT (project_id, user_id) DO NOTHING`,
          [projectId, architectIds]
        );
      }

      await client.query("COMMIT");
      return updated;
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  }

  // Simple update (no architect sync)
  const {
    rows: [updated],
  } = await pool.query(
    `UPDATE project SET ${updates.join(", ")} WHERE id = $${idx} RETURNING *`,
    values
  );
  return updated;
}

/** Delete a project by ID (archives it). Returns true if successful. */
export async function deleteProject(projectId: string): Promise<boolean> {
  const pool = getPool();
  const { rowCount } = await pool.query(
    `UPDATE project SET status = 'archived', updated_at = now() WHERE id = $1 AND status != 'archived'`,
    [projectId]
  );
  return (rowCount ?? 0) > 0;
}

// ---------------------------------------------------------------------------
// Comments (project-level)
// ---------------------------------------------------------------------------

/** Create a comment on a project/phase/task. */
export async function createComment(params: {
  projectId: string;
  phaseId: string | null;
  taskId: string | null;
  userId: string;
  content: string;
}) {
  const pool = getPool();
  const {
    rows: [comment],
  } = await pool.query(
    `INSERT INTO comment (project_id, phase_id, task_id, user_id, content)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [
      params.projectId,
      params.phaseId,
      params.taskId,
      params.userId,
      params.content,
    ]
  );
  return comment;
}

/** Get project name by ID. */
export async function getProjectName(
  projectId: string
): Promise<string | null> {
  const pool = getPool();
  const {
    rows: [row],
  } = await pool.query(`SELECT name FROM project WHERE id = $1`, [projectId]);
  return row?.name ?? null;
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
  reviewStatus: string
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

/** Get project name and client email. */
export async function getProjectClientInfo(projectId: string) {
  const pool = getPool();
  const {
    rows: [row],
  } = await pool.query(
    `SELECT p.name AS project_name, p.client_email
     FROM project p WHERE p.id = $1`,
    [projectId]
  );
  return row || null;
}

// ---------------------------------------------------------------------------
// Send to Client
// ---------------------------------------------------------------------------

/** Get project client email and name for send-to-client flow. */
export async function getProjectForSendToClient(projectId: string) {
  const pool = getPool();
  const {
    rows: [row],
  } = await pool.query(
    `SELECT name, client_name, client_email FROM project WHERE id = $1`,
    [projectId]
  );
  return row || null;
}

/** Check if a user exists by email. */
export async function getUserByEmail(
  email: string
): Promise<{ id: string } | null> {
  const pool = getPool();
  const {
    rows: [row],
  } = await pool.query(`SELECT id FROM "user" WHERE email = $1`, [email]);
  return row || null;
}

/** Pre-create a client user (for send-to-client flow). */
/** Create a client user. Uses ON CONFLICT to handle concurrent creation races. */
export async function createClientUser(name: string, email: string) {
  const pool = getPool();
  await pool.query(
    `INSERT INTO "user" (id, name, email, role, email_verified, created_at, updated_at)
     VALUES (gen_random_uuid(), $1, $2, 'client', false, now(), now())
     ON CONFLICT (email) DO NOTHING`,
    [name, email]
  );
}

// ---------------------------------------------------------------------------
// Approvals
// ---------------------------------------------------------------------------

/** Get approvals for a project. */
export async function getApprovals(projectId: string) {
  const pool = getPool();
  const { rows } = await pool.query(
    `SELECT a.*, u.name AS user_name
     FROM approval a JOIN "user" u ON u.id = a.user_id
     WHERE a.project_id = $1
     ORDER BY a.created_at DESC`,
    [projectId]
  );
  return rows;
}

/** Create an approval record. */
export async function createApproval(params: {
  projectId: string;
  phaseId: string | null;
  userId: string;
  decision: string;
  comment: string;
}) {
  const pool = getPool();
  const {
    rows: [approval],
  } = await pool.query(
    `INSERT INTO approval (project_id, phase_id, user_id, decision, comment)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [
      params.projectId,
      params.phaseId,
      params.userId,
      params.decision,
      params.comment,
    ]
  );
  return approval;
}

/** Atomically mark a project as completed only if all its phases are completed. Returns true if the project was updated. */
export async function markProjectCompletedIfAllPhasesComplete(
  projectId: string
): Promise<boolean> {
  const pool = getPool();
  const { rowCount } = await pool.query(
    `UPDATE project
     SET status = 'completed', updated_at = now()
     WHERE id = $1
       AND status != 'completed'
       AND NOT EXISTS (
         SELECT 1 FROM project_phase pp
         WHERE pp.project_id = $1 AND pp.status != 'completed'
       )`,
    [projectId]
  );
  return (rowCount ?? 0) > 0;
}

/** Get team member emails for a project (all org members). */
export async function getProjectTeamEmails(projectId: string) {
  const pool = getPool();
  const { rows } = await pool.query(
    `SELECT DISTINCT u.email, u.name FROM project p
     JOIN member m ON m."organizationId" = p.org_id
     JOIN "user" u ON u.id = m."userId"
     WHERE p.id = $1`,
    [projectId]
  );
  return rows;
}

// ---------------------------------------------------------------------------
// Phase Tasks (project sub-tasks)
// ---------------------------------------------------------------------------

/** Create a phase task. */
export async function createPhaseTask(params: {
  phaseId: string;
  title: string;
  description: string;
  assignedTo: string | null;
  dueDate: string | null;
}) {
  const pool = getPool();
  const {
    rows: [task],
  } = await pool.query(
    `INSERT INTO phase_task (phase_id, title, description, assigned_to, due_date)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [
      params.phaseId,
      params.title,
      params.description,
      params.assignedTo,
      params.dueDate,
    ]
  );
  return task;
}

const PHASE_TASK_COLS = new Set([
  "title",
  "description",
  "status",
  "assigned_to",
  "due_date",
  "requires_client_review",
]);

/** Update a phase task with dynamic fields. */
export async function updatePhaseTask(
  taskId: string,
  fields: Record<string, unknown>
) {
  const updates: string[] = [];
  const values: unknown[] = [];
  let idx = 1;

  for (const [col, val] of Object.entries(fields)) {
    if (val !== undefined && PHASE_TASK_COLS.has(col)) {
      updates.push(`"${col}" = $${idx}`);
      values.push(val);
      idx++;
    }
  }

  if (updates.length === 0) return null;

  updates.push(`updated_at = now()`);
  values.push(taskId);

  const pool = getPool();
  const {
    rows: [updated],
  } = await pool.query(
    `UPDATE phase_task SET ${updates.join(", ")} WHERE id = $${idx} RETURNING *`,
    values
  );
  return updated;
}

/** Mark a phase task for client review. */
export async function markPhaseTaskForReview(taskId: string) {
  const pool = getPool();
  const {
    rows: [task],
  } = await pool.query(
    `UPDATE phase_task
     SET requires_client_review = true,
         review_status = 'pending_review',
         updated_at = now()
     WHERE id = $1
     RETURNING *`,
    [taskId]
  );
  return task || null;
}

/** Get project info for task review notification (client_email, client_name, name). */
export async function getProjectReviewInfo(projectId: string) {
  const pool = getPool();
  const {
    rows: [row],
  } = await pool.query(
    `SELECT client_email, client_name, name FROM project WHERE id = $1`,
    [projectId]
  );
  return row || null;
}

/** Get a phase task that is pending review. */
export async function getPhaseTaskPendingReview(taskId: string) {
  const pool = getPool();
  const {
    rows: [row],
  } = await pool.query(
    `SELECT * FROM phase_task WHERE id = $1 AND review_status = 'pending_review'`,
    [taskId]
  );
  return row || null;
}

/** Update a phase task's review status and status. */
export async function updatePhaseTaskReviewStatus(
  taskId: string,
  action: string
) {
  const pool = getPool();
  const {
    rows: [task],
  } = await pool.query(
    `UPDATE phase_task
     SET review_status = $1,
         status = CASE WHEN $1 = 'approved' THEN 'approved' ELSE 'changes_requested' END,
         updated_at = now()
     WHERE id = $2
     RETURNING *`,
    [action, taskId]
  );
  return task;
}

// ---------------------------------------------------------------------------
// Pending email change
// ---------------------------------------------------------------------------

export async function createPendingEmailChange(
  userId: string,
  newEmail: string
): Promise<{ token: string }> {
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    // Delete any existing pending changes for this user + expired rows for any user
    await client.query(
      `DELETE FROM pending_email_change WHERE user_id = $1 OR expires_at < NOW()`,
      [userId]
    );
    const { rows } = await client.query(
      `INSERT INTO pending_email_change (user_id, new_email) VALUES ($1, $2) RETURNING token`,
      [userId, newEmail]
    );
    await client.query("COMMIT");
    return { token: rows[0].token };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

interface PendingEmailChange {
  user_id: string;
  new_email: string;
  old_email: string;
  expires_at: string;
  failed_attempts: number;
}

export async function getPendingEmailChange(
  token: string
): Promise<PendingEmailChange | null> {
  const pool = getPool();
  const { rows } = await pool.query(
    `SELECT p.user_id, p.new_email, p.expires_at, p.failed_attempts, u.email AS old_email
     FROM pending_email_change p
     JOIN "user" u ON u.id = p.user_id
     WHERE p.token = $1`,
    [token]
  );
  return rows[0] || null;
}

export async function incrementFailedAttempts(token: string): Promise<number> {
  const pool = getPool();
  const { rows } = await pool.query(
    `UPDATE pending_email_change SET failed_attempts = failed_attempts + 1 WHERE token = $1 RETURNING failed_attempts`,
    [token]
  );
  return rows[0]?.failed_attempts ?? 0;
}

export async function deletePendingEmailChange(token: string) {
  const pool = getPool();
  await pool.query(`DELETE FROM pending_email_change WHERE token = $1`, [
    token,
  ]);
}

export async function isEmailTaken(email: string): Promise<boolean> {
  const pool = getPool();
  const { rows } = await pool.query(
    `SELECT 1 FROM "user" WHERE LOWER(email) = LOWER($1) LIMIT 1`,
    [email]
  );
  return rows.length > 0;
}

/**
 * Update user email and invalidate sessions. Throws `EmailTakenError` if
 * the unique index on LOWER(email) is violated (race-condition safe).
 */
export class EmailTakenError extends Error {
  constructor() {
    super("This email is already in use");
    this.name = "EmailTakenError";
  }
}

export async function updateUserEmail(userId: string, newEmail: string) {
  const pool = getPool();
  try {
    await pool.query(
      `UPDATE "user" SET email = $1, "emailVerified" = true, "updatedAt" = NOW() WHERE id = $2`,
      [newEmail, userId]
    );
  } catch (err: unknown) {
    // Unique constraint violation on email (23505 = unique_violation)
    if (
      typeof err === "object" &&
      err !== null &&
      "code" in err &&
      (err as { code: string }).code === "23505"
    ) {
      throw new EmailTakenError();
    }
    throw err;
  }
  // Invalidate all sessions so the user re-authenticates with the new email
  await pool.query(`DELETE FROM session WHERE "userId" = $1`, [userId]);
}

export async function getAccountPasswordHash(
  userId: string
): Promise<string | null> {
  const pool = getPool();
  const { rows } = await pool.query(
    `SELECT password FROM account WHERE "userId" = $1 AND "providerId" = 'credential' LIMIT 1`,
    [userId]
  );
  return rows[0]?.password ?? null;
}

/** Check whether a user has a credential (email/password) account. */
export async function hasCredentialAccount(userId: string): Promise<boolean> {
  const pool = getPool();
  const { rows } = await pool.query(
    `SELECT EXISTS(SELECT 1 FROM account WHERE "userId" = $1 AND "providerId" = 'credential') AS exists`,
    [userId]
  );
  return rows[0]?.exists ?? false;
}

/** Create a credential account for a user who only has social login (Google). */
export async function createCredentialAccount(
  userId: string,
  passwordHash: string
): Promise<void> {
  const pool = getPool();
  await pool.query(
    `INSERT INTO account (id, "userId", "providerId", "accountId", password, "createdAt", "updatedAt")
     VALUES (gen_random_uuid(), $1, 'credential', $1, $2, NOW(), NOW())
     ON CONFLICT ("userId", "providerId") DO NOTHING`,
    [userId, passwordHash]
  );
}

// ── Email OTP ───────────────────────────────────────────────────────────────

export type OtpPurpose = "set_password" | "email_change";

interface EmailOtp {
  id: string;
  user_id: string;
  code_hash: string;
  purpose: OtpPurpose;
  expires_at: Date;
  attempts: number;
}

/** Delete any existing OTPs for a user+purpose, then insert a new one (atomic). */
export async function createEmailOtp(
  userId: string,
  codeHash: string,
  purpose: OtpPurpose,
  expiresInMs: number = 10 * 60 * 1000 // 10 minutes
): Promise<void> {
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `DELETE FROM email_otp WHERE user_id = $1 AND purpose = $2`,
      [userId, purpose]
    );
    await client.query(
      `INSERT INTO email_otp (user_id, code_hash, purpose, expires_at)
       VALUES ($1, $2, $3, NOW() + ($4 || ' milliseconds')::interval)`,
      [userId, codeHash, purpose, expiresInMs.toString()]
    );
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

/** Fetch the active OTP for a user+purpose. Returns null if none or expired. */
export async function getActiveEmailOtp(
  userId: string,
  purpose: OtpPurpose
): Promise<EmailOtp | null> {
  const pool = getPool();
  const { rows } = await pool.query(
    `SELECT id, user_id, code_hash, purpose, expires_at, attempts
     FROM email_otp
     WHERE user_id = $1 AND purpose = $2 AND expires_at > NOW()
     ORDER BY created_at DESC LIMIT 1`,
    [userId, purpose]
  );
  return rows[0] ?? null;
}

/** Increment failed attempt count. Returns new count. */
export async function incrementOtpAttempts(otpId: string): Promise<number> {
  const pool = getPool();
  const { rows } = await pool.query(
    `UPDATE email_otp SET attempts = attempts + 1 WHERE id = $1 RETURNING attempts`,
    [otpId]
  );
  return rows[0]?.attempts ?? 0;
}

/** Delete an OTP by id (after successful verification). */
export async function deleteEmailOtp(otpId: string): Promise<void> {
  const pool = getPool();
  await pool.query(`DELETE FROM email_otp WHERE id = $1`, [otpId]);
}

/** Cleanup expired OTPs (called opportunistically). */
export async function cleanupExpiredOtps(): Promise<void> {
  const pool = getPool();
  await pool.query(`DELETE FROM email_otp WHERE expires_at < NOW()`);
}
