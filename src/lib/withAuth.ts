import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getServerSession } from "@/lib/serverSession";
import { headers } from "next/headers";
import {
  hasProjectAccess,
  getOrgRole,
  getVendorIdByUserId,
} from "@/lib/queries";
import { deriveEffectiveRole } from "@/lib/effectiveRole";
import { rateLimit } from "@/lib/rateLimit";
import { logger } from "@/lib/logger";
import type { UserRole } from "@/types";

type Session = Awaited<ReturnType<typeof auth.api.getSession>>;
type User = NonNullable<Session>["user"];

export interface AuthContext {
  session: NonNullable<Session>;
  user: User;
  orgId: string | null;
  orgRole?: string | null;
  effectiveRole: UserRole;
  requestId: string;
  /** Resolved vendor_id when the route opts in via `fetchVendorId`. */
  vendorId?: string | null;
}

interface WithAuthOptions {
  /** Only these effective roles are allowed. Returns 403 if the derived role doesn't match. */
  allowedRoles?: string[];
  /** These effective roles are blocked. Returns 403 if the derived role matches. */
  blockedRoles?: string[];
  /** If true, checks hasProjectAccess() using the `id` param. Returns 403 if not allowed. */
  projectAccess?: boolean;
  /** If true, fetches getOrgRole() and includes it in context. */
  fetchOrgRole?: boolean;
  /**
   * If true, resolves `vendor_id` from `vendor_contact.user_id` and exposes it
   * as `ctx.vendorId`. Returns 404 when the caller has no linked vendor record
   * (a vendor user without a `vendor_contact` row shouldn't exist, but fail
   * closed). Only meaningful for vendor-role routes.
   */
  fetchVendorId?: boolean;
  /** Rate limit configuration. If provided, applies rate limiting before the handler runs. */
  rateLimit?: { limit: number; windowMs: number };
}

/**
 * Next.js 16 calls route handlers with a non-optional context object, even
 * for static routes (where `params` resolves to `{}`). Keeping this required
 * matches the generated `.next/dev/types/…/route.ts` shims — making it
 * optional trips a `RouteParams | undefined` vs `RouteContext` incompatibility.
 */
type RouteParams = { params: Promise<Record<string, string>> };

type AuthHandler = (
  req: NextRequest,
  ctx: AuthContext,
  params: Record<string, string>
) => Promise<NextResponse>;

/** Add the X-Request-Id header to a NextResponse. */
function withRequestId(
  response: NextResponse,
  requestId: string
): NextResponse {
  response.headers.set("X-Request-Id", requestId);
  return response;
}

/** Wrap a route handler with session, role, and project-access checks. */
export function withAuth(options: WithAuthOptions, handler: AuthHandler) {
  return async (
    req: NextRequest,
    routeParams: RouteParams = { params: Promise.resolve({}) }
  ): Promise<NextResponse<unknown>> => {
    const requestId = crypto.randomUUID();
    const route = req.nextUrl.pathname;

    // CSRF origin check for mutating methods (fail-closed)
    const method = req.method.toUpperCase();
    if (["POST", "PATCH", "PUT", "DELETE"].includes(method)) {
      const origin = req.headers.get("origin");
      const host = req.headers.get("host");
      if (!origin) {
        logger.warn("CSRF origin missing", { requestId, route, method });
        return withRequestId(
          NextResponse.json({ error: "CSRF origin missing" }, { status: 403 }),
          requestId
        );
      }
      if (!host) {
        logger.warn("CSRF host missing", { requestId, route, method });
        return withRequestId(
          NextResponse.json({ error: "CSRF host missing" }, { status: 403 }),
          requestId
        );
      }
      let originHost: string;
      try {
        originHost = new URL(origin).host;
      } catch {
        return withRequestId(
          NextResponse.json({ error: "Invalid origin" }, { status: 403 }),
          requestId
        );
      }
      if (originHost !== host) {
        logger.warn("CSRF origin mismatch", {
          requestId,
          route,
          method,
          origin: originHost,
          host,
        });
        return withRequestId(
          NextResponse.json({ error: "CSRF origin mismatch" }, { status: 403 }),
          requestId
        );
      }
    }

    const reqHeaders = await headers();

    const session = await getServerSession();
    if (!session) {
      logger.warn("Unauthorized request — no session", { requestId, route });
      return withRequestId(
        NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
        requestId
      );
    }

    const user = session.user;
    const resolvedParams = routeParams?.params ? await routeParams.params : {};

    // Resolve orgId early — needed for effective role derivation
    let orgId = session.session.activeOrganizationId ?? null;
    if (!orgId) {
      const orgs = await auth.api.listOrganizations({
        headers: reqHeaders,
      });
      if (orgs && orgs.length > 0) orgId = orgs[0].id;
    }

    // Derive the effective role. Only query when the route actually needs
    // role info — avoids an extra DB round-trip on every request.
    //
    // When the route opts into `projectAccess`, pass the projectId so the
    // derivation can promote architects-with-project-PM-rows to "pm" for
    // this request. Non-project routes (e.g. POST /api/projects, /api/team)
    // stay strictly org-scoped — project-PMs don't get global PM authority.
    let role: UserRole = (user.role as UserRole) ?? "pm";
    const needsRole =
      options.allowedRoles ||
      options.blockedRoles ||
      options.projectAccess ||
      options.fetchOrgRole;
    if (needsRole) {
      const scopedProjectId = options.projectAccess
        ? (resolvedParams.id ?? null)
        : null;
      role = await deriveEffectiveRole(
        user.id,
        orgId,
        user.role,
        scopedProjectId
      );
    }

    // Role checks (using effective role)
    if (options.allowedRoles && !options.allowedRoles.includes(role)) {
      logger.warn("Forbidden — role not allowed", {
        requestId,
        route,
        userId: user.id,
        role,
        allowedRoles: options.allowedRoles,
      });
      return withRequestId(
        NextResponse.json({ error: "Forbidden" }, { status: 403 }),
        requestId
      );
    }
    if (options.blockedRoles && options.blockedRoles.includes(role)) {
      logger.warn("Forbidden — role blocked", {
        requestId,
        route,
        userId: user.id,
        role,
      });
      return withRequestId(
        NextResponse.json({ error: "Forbidden" }, { status: 403 }),
        requestId
      );
    }

    // Project access check
    if (options.projectAccess) {
      const projectId = resolvedParams.id;
      if (!projectId) {
        return withRequestId(
          NextResponse.json({ error: "Missing project ID" }, { status: 400 }),
          requestId
        );
      }
      const allowed = await hasProjectAccess(
        projectId,
        user.id,
        user.email,
        role
      );
      if (!allowed) {
        logger.warn("Forbidden — no project access", {
          requestId,
          route,
          userId: user.id,
          projectId,
        });
        return withRequestId(
          NextResponse.json({ error: "Forbidden" }, { status: 403 }),
          requestId
        );
      }
    }

    // Rate limit check
    if (options.rateLimit) {
      const key = `${req.method}:${req.nextUrl.pathname}:${user.id}`;
      const { allowed } = rateLimit(key, options.rateLimit);
      if (!allowed) {
        logger.warn("Rate limited", { requestId, route, userId: user.id });
        return withRequestId(
          NextResponse.json(
            { error: "Too many requests. Please wait a moment." },
            { status: 429 }
          ),
          requestId
        );
      }
    }

    // Org role
    let orgRole: string | null | undefined;
    if (options.fetchOrgRole) {
      const projectId = resolvedParams.id;
      if (projectId) {
        orgRole = await getOrgRole(projectId, user.id);
      }
    }

    // Vendor id
    let vendorId: string | null | undefined;
    if (options.fetchVendorId) {
      vendorId = await getVendorIdByUserId(user.id);
      if (!vendorId) {
        logger.warn("Vendor record not found for vendor user", {
          requestId,
          route,
          userId: user.id,
        });
        return withRequestId(
          NextResponse.json(
            { error: "Vendor record not found" },
            { status: 404 }
          ),
          requestId
        );
      }
    }

    try {
      const response = await handler(
        req,
        {
          session,
          user,
          orgId,
          orgRole,
          effectiveRole: role,
          requestId,
          vendorId,
        },
        resolvedParams
      );
      return withRequestId(response, requestId);
    } catch (err) {
      logger.error("Unhandled error in route handler", {
        requestId,
        route,
        userId: user.id,
        error: err,
      });
      return withRequestId(
        NextResponse.json({ error: "Internal Server Error" }, { status: 500 }),
        requestId
      );
    }
  };
}
