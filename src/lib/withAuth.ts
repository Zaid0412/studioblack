import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { hasProjectAccess, getOrgRole } from "@/lib/queries";

type Session = Awaited<ReturnType<typeof auth.api.getSession>>;
type User = NonNullable<Session>["user"];

export interface AuthContext {
  session: NonNullable<Session>;
  user: User;
  orgId: string | null;
  orgRole?: string | null;
}

interface WithAuthOptions {
  /** Only these roles are allowed. Returns 403 if user.role doesn't match. */
  allowedRoles?: string[];
  /** These roles are blocked. Returns 403 if user.role matches. */
  blockedRoles?: string[];
  /** If true, checks hasProjectAccess() using the `id` param. Returns 403 if not allowed. */
  projectAccess?: boolean;
  /** If true, fetches getOrgRole() and includes it in context. */
  fetchOrgRole?: boolean;
}

type RouteParams = { params: Promise<Record<string, string>> };

type AuthHandler = (
  req: NextRequest,
  ctx: AuthContext,
  params: Record<string, string>
) => Promise<NextResponse>;

/** Wrap a route handler with session, role, and project-access checks. */
export function withAuth(options: WithAuthOptions, handler: AuthHandler) {
  return async (
    req: NextRequest,
    routeParams?: RouteParams
  ): Promise<NextResponse<unknown>> => {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = session.user;
    const resolvedParams = routeParams?.params ? await routeParams.params : {};

    // Role checks
    const role = user.role ?? "";
    if (options.allowedRoles && !options.allowedRoles.includes(role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (options.blockedRoles && options.blockedRoles.includes(role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Project access check
    if (options.projectAccess) {
      const projectId = resolvedParams.id;
      if (!projectId) {
        return NextResponse.json(
          { error: "Missing project ID" },
          { status: 400 }
        );
      }
      const allowed = await hasProjectAccess(
        projectId,
        user.id,
        user.email,
        user.role
      );
      if (!allowed) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    // Resolve orgId
    let orgId = session.session.activeOrganizationId ?? null;
    if (!orgId) {
      const orgs = await auth.api.listOrganizations({
        headers: await headers(),
      });
      if (orgs && orgs.length > 0) orgId = orgs[0].id;
    }

    // Org role
    let orgRole: string | null | undefined;
    if (options.fetchOrgRole) {
      const projectId = resolvedParams.id;
      if (projectId) {
        orgRole = await getOrgRole(projectId, user.id);
      }
    }

    return handler(req, { session, user, orgId, orgRole }, resolvedParams);
  };
}
