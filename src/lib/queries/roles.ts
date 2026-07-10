import { cache } from "react";
import { getPool } from "@/lib/db";

// ---------------------------------------------------------------------------
// Access control
// ---------------------------------------------------------------------------

/**
 * Get a user's role within an organization (owner/admin/member or null).
 *
 * Wrapped in React `cache()` so repeated calls in one request (the dashboard
 * layout queries it directly *and* via `deriveEffectiveRole`, and `withAuth`
 * hits it too) collapse to a single DB round-trip. Outside a request context
 * (tests/scripts) `cache()` is a transparent passthrough.
 */
export const getMemberRole = cache(async function getMemberRole(
  orgId: string,
  userId: string
): Promise<string | null> {
  const pool = getPool();
  const { rows } = await pool.query(
    `SELECT role FROM member WHERE "organizationId" = $1 AND "userId" = $2`,
    [orgId, userId]
  );
  return rows[0]?.role ?? null;
});

/**
 * Check whether a user has been explicitly assigned as a PM on a specific
 * project. Lets architects act as PMs on individual projects without holding
 * org-wide PM (admin) authority. See `deriveEffectiveRole` for the call site.
 */
export async function isProjectPm(
  projectId: string,
  userId: string
): Promise<boolean> {
  const pool = getPool();
  const { rows } = await pool.query(
    `SELECT 1 FROM project_member
     WHERE project_id = $1 AND user_id = $2 AND role = 'pm'`,
    [projectId, userId]
  );
  return rows.length > 0;
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

/**
 * Check if a user has access to a project.
 *
 * Access rules:
 * - Org owner: implicit access to every project in their org.
 * - PM (org admin): must have an explicit `project_member` row with role='pm'.
 * - Architect (org member): must have a `project_member` row with role='architect'.
 * - Client: project's `client_email` must match.
 */
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

  // Org owner short-circuit: owners see every project in their org regardless
  // of project_member rows. Admins (also role 'pm') need an explicit assignment.
  const { rows } = await pool.query(
    `SELECT m.role AS org_role,
            EXISTS (
              SELECT 1 FROM project_member pm
              WHERE pm.project_id = p.id AND pm.user_id = $2
            ) AS is_member
     FROM project p
     JOIN member m ON m."organizationId" = p.org_id AND m."userId" = $2
     WHERE p.id = $1`,
    [projectId, userId]
  );
  if (rows.length === 0) return false;
  const { org_role, is_member } = rows[0];
  if (org_role === "owner") return true;
  return Boolean(is_member);
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
