import { getPool } from "@/lib/db";
import { PROJECT_PHASES, PROJECT_STEPS } from "@/lib/constants";

// ---------------------------------------------------------------------------
// Project CRUD
// ---------------------------------------------------------------------------

interface CreateProjectInput {
  name: string;
  clientName?: string;
  clientEmail?: string;
  category: string;
  description?: string;
  deadline?: string;
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

    // Insert project
    const {
      rows: [project],
    } = await client.query(
      `INSERT INTO project (name, client_name, client_email, category, description, deadline, org_id, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        input.name,
        input.clientName || null,
        input.clientEmail || null,
        input.category,
        input.description || "",
        input.deadline || null,
        input.orgId,
        input.createdBy,
      ]
    );

    // Insert 7 workflow steps
    const stepIds: string[] = [];
    for (let i = 0; i < PROJECT_STEPS.length; i++) {
      const {
        rows: [step],
      } = await client.query(
        `INSERT INTO project_step (project_id, name, step_order) VALUES ($1, $2, $3) RETURNING id`,
        [project.id, PROJECT_STEPS[i], i + 1]
      );
      stepIds.push(step.id);
    }

    // Insert phases (custom if provided, otherwise default 6)
    const designStepId = stepIds[1]; // "Design" is step index 1
    const phaseNames = input.phases?.length
      ? input.phases
      : [...PROJECT_PHASES];
    for (let i = 0; i < phaseNames.length; i++) {
      await client.query(
        `INSERT INTO project_phase (project_id, name, phase_order, step_id) VALUES ($1, $2, $3, $4)`,
        [project.id, phaseNames[i], i + 1, designStepId]
      );
    }

    // Assign architects
    if (input.architectIds?.length) {
      for (const userId of input.architectIds) {
        await client.query(
          `INSERT INTO project_member (project_id, user_id, role) VALUES ($1, $2, 'architect')
           ON CONFLICT (project_id, user_id) DO NOTHING`,
          [project.id, userId]
        );
      }
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
     WHERE p.org_id = $1
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
     WHERE p.org_id = $2
     ORDER BY p.created_at DESC`,
    [userId, orgId]
  );
  return rows;
}

/** Get projects where the client email matches (client portal). */
export async function getProjectsByClientEmail(email: string) {
  const pool = getPool();
  const { rows } = await pool.query(
    `SELECT * FROM project WHERE client_email = $1 ORDER BY created_at DESC`,
    [email]
  );
  return rows;
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
}) {
  const pool = getPool();
  let query = `SELECT a.*, u.name AS uploaded_by_name
               FROM attachment a JOIN "user" u ON u.id = a.uploaded_by
               WHERE a.project_id = $1`;
  const params: string[] = [filters.projectId];

  if (!filters.all) {
    if (filters.taskId) {
      query += ` AND a.task_id = $${params.length + 1}`;
      params.push(filters.taskId);
    } else if (filters.phaseId) {
      query += ` AND a.phase_id = $${params.length + 1} AND a.task_id IS NULL`;
      params.push(filters.phaseId);
    } else {
      query += ` AND a.phase_id IS NULL AND a.task_id IS NULL`;
    }
  }

  query += ` ORDER BY a.created_at`;
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

/** Get all versions of a file (by version_group). */
export async function getAttachmentVersionHistory(versionGroup: string) {
  const pool = getPool();
  const { rows } = await pool.query(
    `SELECT a.*, u.name AS uploaded_by_name
     FROM attachment a
     JOIN "user" u ON u.id = a.uploaded_by
     WHERE a.version_group = $1
     ORDER BY a.version DESC`,
    [versionGroup]
  );
  return rows;
}

/** Update the review status of an attachment. */
export async function updateAttachmentReviewStatus(
  attachmentId: string,
  status: string,
  reviewedBy: string
) {
  const pool = getPool();
  const {
    rows: [row],
  } = await pool.query(
    `UPDATE attachment SET review_status = $1, reviewed_by = $2 WHERE id = $3 RETURNING *`,
    [status, reviewedBy, attachmentId]
  );
  return row;
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
  // Get the current max version for this group
  const {
    rows: [{ max }],
  } = await pool.query(
    `SELECT COALESCE(MAX(version), 0) AS max FROM attachment WHERE version_group = $1`,
    [versionGroup]
  );
  const nextVersion = (max as number) + 1;
  const {
    rows: [row],
  } = await pool.query(
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
  return row;
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

interface TaskFilters {
  orgId: string;
  bucket?:
    | "all"
    | "my_tasks"
    | "created_by_me"
    | "important"
    | "upcoming"
    | "completed";
  userId: string;
  projectId?: string;
  status?: string;
  priority?: string;
  category?: string;
  search?: string;
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
    case "important":
      conditions.push(
        `t.priority IN ('high', 'urgent') AND t.status != 'completed' AND t.status != 'archived'`
      );
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
  if (filters.search) {
    conditions.push(`(t.title ILIKE $${idx} OR t.description ILIKE $${idx})`);
    values.push(`%${filters.search}%`);
    idx++;
  }

  const { rows } = await pool.query(
    `SELECT t.*,
            u_assigned.name AS assigned_to_name,
            u_created.name AS created_by_name,
            p.name AS project_name
     FROM task t
     LEFT JOIN "user" u_assigned ON u_assigned.id = t.assigned_to
     LEFT JOIN "user" u_created ON u_created.id = t.created_by
     LEFT JOIN project p ON p.id = t.project_id
     WHERE ${conditions.join(" AND ")}
     ORDER BY
       CASE t.priority WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END,
       CASE WHEN t.due_date IS NULL THEN 1 ELSE 0 END,
       t.due_date ASC NULLS LAST,
       t.created_at DESC
     LIMIT 200`,
    values
  );
  return rows;
}

/** Fetch a single task by ID with joined user and project names. */
export async function getTaskById(taskId: string) {
  const pool = getPool();
  const { rows } = await pool.query(
    `SELECT t.*,
            u_assigned.name AS assigned_to_name,
            u_created.name AS created_by_name,
            p.name AS project_name
     FROM task t
     LEFT JOIN "user" u_assigned ON u_assigned.id = t.assigned_to
     LEFT JOIN "user" u_created ON u_created.id = t.created_by
     LEFT JOIN project p ON p.id = t.project_id
     WHERE t.id = $1`,
    [taskId]
  );
  return rows[0] || null;
}

/** Get task counts for each smart bucket in a single query. */
export async function getTaskBucketCounts(orgId: string, userId: string) {
  const pool = getPool();
  const { rows } = await pool.query(
    `SELECT
       COUNT(*) FILTER (WHERE status != 'archived')::int AS all,
       COUNT(*) FILTER (WHERE assigned_to = $2 AND status != 'archived')::int AS my_tasks,
       COUNT(*) FILTER (WHERE created_by = $2 AND (assigned_to IS NULL OR assigned_to != $2) AND status != 'archived')::int AS created_by_me,
       COUNT(*) FILTER (WHERE priority IN ('high', 'urgent') AND status NOT IN ('completed', 'archived'))::int AS important,
       COUNT(*) FILTER (WHERE due_date IS NOT NULL AND status NOT IN ('completed', 'archived'))::int AS upcoming,
       COUNT(*) FILTER (WHERE status = 'completed')::int AS completed
     FROM task WHERE org_id = $1`,
    [orgId, userId]
  );
  return rows[0];
}
