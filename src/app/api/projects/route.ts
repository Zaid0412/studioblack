import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import {
  createProjectWithPhases,
  getProjectsByOrgId,
  getProjectsByArchitectId,
  getProjectsByPmId,
  getUsersByIds,
  checkUserExistsByEmail,
} from "@/lib/queries";
import { sendNotificationEmail, escapeHtml } from "@/lib/email";
import { notifyPmAssignment } from "@/lib/notifications";
import { withAuth } from "@/lib/withAuth";
import { env } from "@/env";
import { parseRequest, createProjectSchema } from "@/lib/validations";
import { logger } from "@/lib/logger";

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

  // Derive scope from org membership:
  // - owner → implicit access to every org project (getProjectsByOrgId)
  // - admin → PM with explicit assignments only (getProjectsByPmId)
  // - member → architect with explicit assignments only (getProjectsByArchitectId)
  const members = await auth.api.listMembers({
    headers: await headers(),
    query: { organizationId: orgId },
  });
  const me = members?.members?.find(
    (m: { userId: string }) => m.userId === user.id
  );

  let projects;
  if (me?.role === "owner") {
    projects = await getProjectsByOrgId(orgId);
  } else if (me?.role === "admin") {
    projects = await getProjectsByPmId(user.id, orgId);
  } else {
    projects = await getProjectsByArchitectId(user.id, orgId);
  }

  return NextResponse.json(projects);
});

/** POST /api/projects — create a new project (org owner only). */
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

    // Owner-only: admins (also effectiveRole='pm') can't create projects.
    // PM assignment is an ownership operation.
    const members = await auth.api.listMembers({
      headers: await headers(),
      query: { organizationId: orgId },
    });
    const me = members?.members?.find(
      (m: { userId: string }) => m.userId === user.id
    );
    if (me?.role !== "owner") {
      return NextResponse.json(
        { error: "Only org owners can create projects" },
        { status: 403 }
      );
    }

    const parsed = await parseRequest(req, createProjectSchema);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }
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
      pmIds,
    } = parsed.data;

    // Always include the creator as a PM (deduped). The creator is the org
    // owner — they already have implicit access — but keeping their row makes
    // the membership list explicit and survives any future relaxation of the
    // owner short-circuit.
    const finalPmIds = Array.from(new Set([...(pmIds ?? []), user.id]));

    try {
      const project = await createProjectWithPhases({
        name,
        clientName,
        clientEmail: clientEmail ?? undefined,
        category,
        deadline: deadline ?? undefined,
        scope,
        areaSqft: areaSqft ?? undefined,
        estimationInr: estimationInr ?? undefined,
        address,
        city,
        state,
        phases,
        orgId,
        createdBy: user.id,
        architectIds,
        pmIds: finalPmIds,
      });

      // Notify newly-assigned PMs (in-app + email). Skip the creator —
      // they're auto-added and don't need to be told they own their own
      // project.
      const baseUrl = env().NEXT_PUBLIC_APP_URL;
      const projectUrlPlain = `${baseUrl}/projects/${encodeURIComponent(project.id)}`;
      notifyPmAssignment(
        project.id,
        finalPmIds,
        name,
        projectUrlPlain,
        user.id
      );

      // Notify assigned architects (fire-and-forget, parallel)
      if (architectIds?.length) {
        const projectUrl = escapeHtml(
          `${baseUrl}/projects/${encodeURIComponent(project.id)}`
        );
        const safeName = escapeHtml(name);
        getUsersByIds(architectIds)
          .then((rows) => {
            for (const arch of rows) {
              sendNotificationEmail(
                arch.email,
                `${name} | New Project Assignment`,
                `<p>You've been assigned to project <strong>${safeName}</strong>.</p>
             <p><a href="${projectUrl}">View the project</a> to see details and start working.</p>`
              ).catch((err) =>
                logger.error("Failed to send architect notification email", {
                  error: err,
                })
              );
            }
          })
          .catch((err) =>
            logger.error("Failed to fetch architects for notification", {
              error: err,
            })
          );
      }

      // Notify client (fire-and-forget)
      if (clientEmail) {
        checkUserExistsByEmail(clientEmail)
          .then((isRegistered) => {
            const link = escapeHtml(
              isRegistered
                ? `${baseUrl}/login`
                : `${baseUrl}/register?email=${encodeURIComponent(clientEmail)}`
            );
            const linkLabel = isRegistered ? "Log in" : "Create your account";

            sendNotificationEmail(
              clientEmail,
              `${name} | You've Been Added to a Project`,
              `<p>You've been added to project <strong>${escapeHtml(name)}</strong> as a client.</p>
           <p><a href="${link}">${linkLabel}</a> to view the project details and track progress.</p>`
            ).catch((err) =>
              logger.error("Failed to send client notification email", {
                clientEmail,
                error: err,
              })
            );
          })
          .catch((err) =>
            logger.error("Failed to check client existence for notification", {
              clientEmail,
              error: err,
            })
          );
      }

      return NextResponse.json(project, { status: 201 });
    } catch (err) {
      logger.error("Failed to create project", { error: err });
      return NextResponse.json(
        { error: "Failed to create project" },
        { status: 500 }
      );
    }
  }
);
