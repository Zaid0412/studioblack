import { getPool } from "@/lib/db";

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
