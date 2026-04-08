import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import {
  createProjectWithPhases,
  getProjectsByOrgId,
  getProjectsByArchitectId,
} from "@/lib/queries";
import { sendNotificationEmail, escapeHtml } from "@/lib/email";
import { getPool } from "@/lib/db";
import { withAuth } from "@/lib/withAuth";

/** GET /api/projects — list projects for the current user's org. */
export const GET = withAuth({}, async (req, { session, user }) => {
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
    return NextResponse.json(
      { error: "No active organization" },
      { status: 400 }
    );
  }

  // Derive effective role from org membership
  const members = await auth.api.listMembers({
    headers: await headers(),
    query: { organizationId: orgId },
  });
  const me = members?.members?.find(
    (m: { userId: string }) => m.userId === user.id
  );
  const effectiveRole =
    me?.role === "owner" || me?.role === "admin" ? "pm" : "architect";

  const projects =
    effectiveRole === "architect"
      ? await getProjectsByArchitectId(user.id, orgId)
      : await getProjectsByOrgId(orgId);

  return NextResponse.json(projects);
});

/** POST /api/projects — create a new project (PM only). */
export const POST = withAuth(
  { allowedRoles: ["pm"] },
  async (req, { session, user }) => {
    const orgId = session.session.activeOrganizationId;
    if (!orgId) {
      return NextResponse.json(
        { error: "No active organization" },
        { status: 400 }
      );
    }

    const body = await req.json();
    const {
      name,
      clientName,
      clientEmail,
      category,
      deadline,
      scope,
      areaSqft,
      estimationInr,
      address,
      city,
      state,
      phases,
      architectIds,
    } = body;

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
        deadline,
        scope,
        areaSqft,
        estimationInr,
        address,
        city,
        state,
        phases,
        orgId,
        createdBy: user.id,
        architectIds,
      });

      // Notify assigned architects
      const baseUrl =
        process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
      if (architectIds?.length) {
        const pool = getPool();
        const projectUrl = `${baseUrl}/projects/${project.id}`;
        for (const archId of architectIds) {
          const { rows } = await pool.query(
            `SELECT email, name FROM "user" WHERE id = $1`,
            [archId]
          );
          if (rows[0]) {
            await sendNotificationEmail(
              rows[0].email,
              "New Project Assignment",
              `<p>You've been assigned to project <strong>${escapeHtml(name)}</strong>.</p>
             <p><a href="${projectUrl}">View the project</a> to see details and start working.</p>`
            ).catch(console.error);
          }
        }
      }

      // Notify client
      if (clientEmail) {
        const pool = getPool();
        const { rows: clientRows } = await pool.query(
          `SELECT id FROM "user" WHERE email = $1 LIMIT 1`,
          [clientEmail]
        );
        const isRegistered = clientRows.length > 0;
        const link = isRegistered
          ? `${baseUrl}/login`
          : `${baseUrl}/register?email=${encodeURIComponent(clientEmail)}`;
        const linkLabel = isRegistered ? "Log in" : "Create your account";

        sendNotificationEmail(
          clientEmail,
          "You've Been Added to a Project",
          `<p>You've been added to project <strong>${escapeHtml(name)}</strong> as a client.</p>
           <p><a href="${link}">${linkLabel}</a> to view the project details and track progress.</p>`
        ).catch(console.error);
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
);
