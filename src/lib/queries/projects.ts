import { getPool } from "@/lib/db";
import { PROJECT_PHASES, PROJECT_STEPS } from "@/lib/constants";
import { nextProjectNumber } from "./sequences";

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
  /** BOQ line-number spacing (default 10). */
  lineIncrement?: number;
  /** Custom phase names. Falls back to PROJECT_PHASES if empty/omitted. */
  phases?: string[];
  orgId: string;
  createdBy: string;
  architectIds?: string[];
  /** PMs assigned to the project. Caller is expected to dedupe + include the creator if they're a PM. */
  pmIds?: string[];
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

    // Claim the project's business reference (P2026-001) inside the transaction,
    // so a rollback returns the number instead of burning it.
    const projectNumber = await nextProjectNumber(client, input.orgId);

    // Insert project
    const {
      rows: [project],
    } = await client.query(
      `INSERT INTO project (name, client_name, client_email, category, deadline, scope, area_sqft, estimation_inr, address, city, state, org_id, created_by, project_number, line_increment)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, COALESCE($15, 10))
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
        projectNumber,
        input.lineIncrement ?? null,
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

    // Assign PMs (single multi-row INSERT).
    //
    // `project_member` is `UNIQUE(project_id, user_id)` — at most one row per
    // (project, user), regardless of role. If the same user is in both
    // architectIds and pmIds, PM wins: the architect INSERT above ran first
    // and may have re-added them as architect; this clause flips that row to
    // role='pm'.
    if (input.pmIds?.length) {
      await client.query(
        `INSERT INTO project_member (project_id, user_id, role)
         SELECT $1, unnest($2::text[]), 'pm'
         ON CONFLICT (project_id, user_id) DO UPDATE SET role = 'pm'`,
        [project.id, input.pmIds]
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

/** Get all projects for an org (org-owner dashboard — implicit access to everything). */
export async function getProjectsByOrgId(orgId: string) {
  const pool = getPool();
  const { rows } = await pool.query(
    `SELECT p.*,
            array_agg(DISTINCT pm.user_id) FILTER (WHERE pm.role = 'architect') AS architect_ids,
            array_agg(DISTINCT pm.user_id) FILTER (WHERE pm.role = 'pm') AS pm_ids
     FROM project p
     LEFT JOIN project_member pm ON pm.project_id = p.id
     WHERE p.org_id = $1 AND p.status != 'archived'
     GROUP BY p.id
     ORDER BY p.created_at DESC`,
    [orgId]
  );
  return rows;
}

/**
 * Get projects an org member (architect) is assigned to, regardless of the
 * role they hold on each one. Architects normally show up as `role='architect'`,
 * but project-scoped PM authority promotes them to `role='pm'` on individual
 * projects — they should still see those projects in their dashboard list.
 */
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

/**
 * Get projects a PM (org admin) is explicitly assigned to. Org owners use
 * `getProjectsByOrgId` instead — they have implicit access to all projects.
 */
export async function getProjectsByPmId(userId: string, orgId: string) {
  const pool = getPool();
  const { rows } = await pool.query(
    `SELECT p.*
     FROM project p
     JOIN project_member pm ON pm.project_id = p.id
       AND pm.user_id = $1
       AND pm.role = 'pm'
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

/**
 * Enable/disable a phase's visibility (non-destructive — data is preserved).
 * Refuses to disable the last enabled phase, so a project always shows at
 * least one.
 */
export async function setPhaseEnabled(
  projectId: string,
  phaseId: string,
  enabled: boolean
) {
  const pool = getPool();

  if (!enabled) {
    const { rows } = await pool.query(
      `SELECT COUNT(*) FROM project_phase WHERE project_id = $1 AND enabled AND id != $2`,
      [projectId, phaseId]
    );
    if (Number(rows[0].count) === 0) {
      throw new Error("At least one phase must stay enabled");
    }
  }

  const {
    rows: [updated],
  } = await pool.query(
    `UPDATE project_phase SET enabled = $3, updated_at = now() WHERE id = $2 AND project_id = $1 RETURNING *`,
    [projectId, phaseId, enabled]
  );
  return updated || null;
}

/**
 * Enable/disable a workflow step's visibility (non-destructive). Refuses to
 * disable the Design step — the project's phases hang off it via
 * `project_phase.step_id`.
 */
export async function setStepEnabled(
  projectId: string,
  stepId: string,
  enabled: boolean
) {
  const pool = getPool();

  if (!enabled) {
    const { rows } = await pool.query(
      `SELECT name FROM project_step WHERE id = $1 AND project_id = $2`,
      [stepId, projectId]
    );
    if (rows[0]?.name === "Design") {
      throw new Error("The Design step cannot be disabled");
    }
  }

  const {
    rows: [updated],
  } = await pool.query(
    // project_step has no updated_at column (unlike project_phase).
    `UPDATE project_step SET enabled = $3 WHERE id = $2 AND project_id = $1 RETURNING *`,
    [projectId, stepId, enabled]
  );
  return updated || null;
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
  "line_increment",
  "default_currency",
  "default_unit",
  "default_vat_pct",
  "default_contingency_pct",
  "default_min_margin_pct",
  "default_service_charge_pct",
]);

/**
 * Update a project with dynamic fields + optional architect/PM sync (transactional).
 *
 * `architectIds` and `pmIds` use a delete-and-reinsert pattern per role. Passing
 * an empty array clears that role; passing `undefined` leaves it untouched.
 * Callers must enforce business rules (e.g. min 1 PM) before calling.
 */
export async function updateProject(
  projectId: string,
  fields: Record<string, unknown>,
  architectIds?: string[],
  pmIds?: string[]
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

  const hasArchitectSync = architectIds !== undefined;
  const hasPmSync = pmIds !== undefined;

  if (updates.length === 0 && !hasArchitectSync && !hasPmSync) return null;

  updates.push(`updated_at = now()`);
  values.push(projectId);

  const pool = getPool();

  if (hasArchitectSync || hasPmSync) {
    // Transaction: update project + sync member rows for each provided role.
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

      if (hasArchitectSync) {
        await client.query(
          `DELETE FROM project_member WHERE project_id = $1 AND role = 'architect'`,
          [projectId]
        );
        if (architectIds!.length > 0) {
          await client.query(
            `INSERT INTO project_member (project_id, user_id, role)
             SELECT $1, unnest($2::text[]), 'architect'
             ON CONFLICT (project_id, user_id) DO NOTHING`,
            [projectId, architectIds]
          );
        }
      }

      if (hasPmSync) {
        await client.query(
          `DELETE FROM project_member WHERE project_id = $1 AND role = 'pm'`,
          [projectId]
        );
        if (pmIds!.length > 0) {
          // PM wins on conflict: when the same user is also in architectIds
          // (which gets synced first above), the existing row is already
          // role='architect'. Without DO UPDATE the PM INSERT would silently
          // no-op and the architect row would shadow the PM assignment.
          await client.query(
            `INSERT INTO project_member (project_id, user_id, role)
             SELECT $1, unnest($2::text[]), 'pm'
             ON CONFLICT (project_id, user_id) DO UPDATE SET role = 'pm'`,
            [projectId, pmIds]
          );
        }
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

  // Simple update (no member sync)
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

/**
 * Permanently delete a project and everything under it. All `project_id` FKs are
 * ON DELETE CASCADE (boq→items, rfq, phases, steps, members, attachments,
 * comments, approvals, tasks, docs); only `rate_contract.project_id` is SET NULL.
 * Destructive and irreversible — the route restricts this to org owners.
 */
export async function hardDeleteProject(projectId: string): Promise<boolean> {
  const pool = getPool();
  const { rowCount } = await pool.query(`DELETE FROM project WHERE id = $1`, [
    projectId,
  ]);
  return (rowCount ?? 0) > 0;
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
