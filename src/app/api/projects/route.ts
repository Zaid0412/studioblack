import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import {
  createProjectWithPhases,
  getProjectsByOrgId,
  getProjectsByArchitectId,
} from "@/lib/queries";
import { sendNotificationEmail } from "@/lib/email";
import { getPool } from "@/lib/db";

/** GET /api/projects — list projects for the current user's org. */
export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Auto-resolve active org if not set
  let orgId = session.session.activeOrganizationId;
  if (!orgId) {
    const orgs = await auth.api.listOrganizations({ headers: await headers() });
    if (orgs && orgs.length > 0) {
      orgId = orgs[0].id;
      await auth.api.setActiveOrganization({
        headers: await headers(),
        body: { organizationId: orgId },
      });
    }
  }

  if (!orgId) {
    return NextResponse.json({ error: "No active organization" }, { status: 400 });
  }

  // Derive effective role from org membership
  const members = await auth.api.listMembers({
    headers: await headers(),
    query: { organizationId: orgId },
  });
  const me = members?.members?.find(
    (m: { userId: string }) => m.userId === session.user.id
  );
  const effectiveRole =
    me?.role === "owner" || me?.role === "admin" ? "pm" : "architect";

  const projects =
    effectiveRole === "architect"
      ? await getProjectsByArchitectId(session.user.id, orgId)
      : await getProjectsByOrgId(orgId);

  return NextResponse.json(projects);
}

/** POST /api/projects — create a new project (PM only). */
export async function POST(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const orgId = session.session.activeOrganizationId;
  if (!orgId) {
    return NextResponse.json({ error: "No active organization" }, { status: 400 });
  }

  // Only PMs (owner/admin) can create projects
  const role = session.user.role;
  if (role !== "pm") {
    return NextResponse.json({ error: "Only PMs can create projects" }, { status: 403 });
  }

  const body = await req.json();
  const { name, clientName, clientEmail, category, description, deadline, architectIds } =
    body;

  if (!name || !category) {
    return NextResponse.json(
      { error: "Name and category are required" },
      { status: 400 }
    );
  }

  try {
    const project = await createProjectWithPhases({
      name,
      clientName,
      clientEmail,
      category,
      description,
      deadline,
      orgId,
      createdBy: session.user.id,
      architectIds,
    });

    // Notify assigned architects
    if (architectIds?.length) {
      const pool = getPool();
      for (const archId of architectIds) {
        const { rows } = await pool.query(
          `SELECT email, name FROM "user" WHERE id = $1`,
          [archId]
        );
        if (rows[0]) {
          await sendNotificationEmail(
            rows[0].email,
            "New Project Assignment",
            `<p>You've been assigned to project <strong>${name}</strong>.</p>
             <p>Log in to view the project details and start working.</p>`
          ).catch(console.error);
        }
      }
    }

    return NextResponse.json(project, { status: 201 });
  } catch (err) {
    console.error("Failed to create project:", err);
    return NextResponse.json(
      { error: "Failed to create project" },
      { status: 500 }
    );
  }
}
