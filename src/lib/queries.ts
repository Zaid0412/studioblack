import { getPool } from "@/lib/db";

/** The 8 fixed project phases — auto-created for every new project. */
export const PROJECT_PHASES = [
  "2D Layout + Look & Feel",
  "3D Design Development & Budgetary BOQ",
  "Services & Working Drawings",
  "Material Selections",
  "Detailed BOQ & Contractor Finalization",
  "Site Work",
  "Vendor & Accessories",
  "Final Handover",
] as const;

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
  orgId: string;
  createdBy: string;
  architectIds?: string[];
}

/** Create a project + 8 phases + member assignments in a single transaction. */
export async function createProjectWithPhases(input: CreateProjectInput) {
  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Insert project
    const { rows: [project] } = await client.query(
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

    // Insert all 8 phases
    for (let i = 0; i < PROJECT_PHASES.length; i++) {
      await client.query(
        `INSERT INTO project_phase (project_id, name, phase_order) VALUES ($1, $2, $3)`,
        [project.id, PROJECT_PHASES[i], i + 1]
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

/** Get a single project by ID with phases. */
export async function getProjectById(projectId: string) {
  const pool = getPool();
  const { rows: [project] } = await pool.query(
    `SELECT * FROM project WHERE id = $1`,
    [projectId]
  );
  if (!project) return null;

  const { rows: phases } = await pool.query(
    `SELECT * FROM project_phase WHERE project_id = $1 ORDER BY phase_order`,
    [projectId]
  );

  const { rows: members } = await pool.query(
    `SELECT pm.*, u.name, u.email FROM project_member pm
     JOIN "user" u ON u.id = pm.user_id
     WHERE pm.project_id = $1`,
    [projectId]
  );

  return { ...project, phases, members };
}

/** Get tasks for a phase. */
export async function getPhaseTasks(phaseId: string) {
  const pool = getPool();
  const { rows } = await pool.query(
    `SELECT t.*, u.name AS assigned_name
     FROM phase_task t
     LEFT JOIN "user" u ON u.id = t.assigned_to
     WHERE t.phase_id = $1
     ORDER BY t.created_at`,
    [phaseId]
  );
  return rows;
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
