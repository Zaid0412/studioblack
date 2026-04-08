import { NextResponse } from "next/server";
import { getProjectById } from "@/lib/queries";
import { getPool } from "@/lib/db";
import { withAuth } from "@/lib/withAuth";

const VALID_PROJECT_STATUSES = ["draft", "active", "completed", "archived"];
const VALID_CATEGORIES = [
  "residential",
  "commercial",
  "healthcare",
  "hospitality",
  "institutional",
  "retail",
  "workspace",
];

/** GET /api/projects/[id] — get project details. */
export const GET = withAuth(
  { projectAccess: true },
  async (req, ctx, params) => {
    const { id } = params;

    const project = await getProjectById(id);
    if (!project) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json(project);
  }
);

/** PATCH /api/projects/[id] — update project (PM: everything, Architect: limited, Client: forbidden). */
export const PATCH = withAuth(
  { blockedRoles: ["client"], projectAccess: true, fetchOrgRole: true },
  async (req, { orgRole }, params) => {
    const { id } = params;

    const body = await req.json();

    if (
      body.status !== undefined &&
      !VALID_PROJECT_STATUSES.includes(body.status)
    ) {
      return NextResponse.json(
        { error: "Invalid project status" },
        { status: 400 }
      );
    }
    if (
      body.category !== undefined &&
      !VALID_CATEGORIES.includes(body.category)
    ) {
      return NextResponse.json(
        { error: "Invalid project category" },
        { status: 400 }
      );
    }

    const pool = getPool();

    // Only owners/admins (PMs) can change project status
    const isPM = orgRole === "owner" || orgRole === "admin";

    // Validate architectIds if provided
    const UUID_RE =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (isPM && Array.isArray(body.architectIds)) {
      for (const aid of body.architectIds) {
        if (typeof aid !== "string" || !UUID_RE.test(aid)) {
          return NextResponse.json(
            { error: "Invalid architect ID format" },
            { status: 400 }
          );
        }
      }
    }

    // Build dynamic update
    const allowedFields = isPM
      ? [
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
        ]
      : ["name"];
    const updates: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    for (const field of allowedFields) {
      const camelField = field.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
      if (body[camelField] !== undefined) {
        updates.push(`${field} = $${idx}`);
        values.push(body[camelField]);
        idx++;
      }
    }

    if (updates.length === 0) {
      return NextResponse.json(
        { error: "No fields to update" },
        { status: 400 }
      );
    }

    updates.push(`updated_at = now()`);
    values.push(id);

    // Run project update + architect sync in a single transaction
    const client = await pool.connect();
    let updated;
    try {
      await client.query("BEGIN");

      const {
        rows: [row],
      } = await client.query(
        `UPDATE project SET ${updates.join(", ")} WHERE id = $${idx} RETURNING *`,
        values
      );
      updated = row;

      // Sync architect assignments if provided (PM only)
      if (isPM && Array.isArray(body.architectIds)) {
        await client.query(
          `DELETE FROM project_member WHERE project_id = $1 AND role = 'architect'`,
          [id]
        );
        if (body.architectIds.length > 0) {
          await client.query(
            `INSERT INTO project_member (project_id, user_id, role)
             SELECT $1, unnest($2::uuid[]), 'architect'
             ON CONFLICT (project_id, user_id) DO NOTHING`,
            [id, body.architectIds]
          );
        }
      }

      await client.query("COMMIT");
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }

    return NextResponse.json(updated);
  }
);

/** DELETE /api/projects/[id] — delete project (PM only). */
export const DELETE = withAuth(
  { fetchOrgRole: true },
  async (req, { orgRole }, params) => {
    const { id } = params;

    // Only org owners/admins (PMs) can delete projects
    if (!orgRole || (orgRole !== "owner" && orgRole !== "admin")) {
      return NextResponse.json(
        { error: "Only PMs can delete projects" },
        { status: 403 }
      );
    }

    const pool = getPool();
    const { rowCount } = await pool.query(`DELETE FROM project WHERE id = $1`, [
      id,
    ]);

    if (!rowCount) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  }
);
