import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { getProjectById, hasProjectAccess } from "@/lib/queries";
import { getPool } from "@/lib/db";

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
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const allowed = await hasProjectAccess(
    id,
    session.user.id,
    session.user.email,
    session.user.role
  );
  if (!allowed) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const project = await getProjectById(id);
  if (!project) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(project);
}

/** PATCH /api/projects/[id] — update project (PM: everything, Architect: limited, Client: forbidden). */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const role = session.user.role;

  if (role === "client") {
    return NextResponse.json(
      { error: "Clients cannot update projects" },
      { status: 403 }
    );
  }

  const allowed = await hasProjectAccess(
    id,
    session.user.id,
    session.user.email,
    role
  );
  if (!allowed) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

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

  // Build dynamic update
  const allowedFields = [
    "name",
    "client_name",
    "client_email",
    "category",
    "status",
    "description",
    "deadline",
  ];
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
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  updates.push(`updated_at = now()`);
  values.push(id);

  const {
    rows: [updated],
  } = await pool.query(
    `UPDATE project SET ${updates.join(", ")} WHERE id = $${idx} RETURNING *`,
    values
  );

  return NextResponse.json(updated);
}

/** DELETE /api/projects/[id] — delete project (PM only). */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  if (session.user.role !== "pm") {
    return NextResponse.json(
      { error: "Only PMs can delete projects" },
      { status: 403 }
    );
  }

  const allowed = await hasProjectAccess(
    id,
    session.user.id,
    session.user.email,
    session.user.role
  );
  if (!allowed) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
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
