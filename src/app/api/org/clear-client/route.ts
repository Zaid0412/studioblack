import { NextResponse } from "next/server";
import { withAuth } from "@/lib/withAuth";
import { clearClientEmailByEmail } from "@/lib/queries";
import { getPool } from "@/lib/db";

/**
 * POST /api/org/clear-client
 *
 * When a client member is removed from the org, clear their client_email
 * from all assigned projects. PM-only.
 *
 * Uses direct org role query instead of fetchOrgRole (which requires a project ID).
 */
export const POST = withAuth(
  { blockedRoles: ["client"] },
  async (req, { user, orgId }) => {
    // Check org role directly — fetchOrgRole requires a project ID param
    if (!orgId) {
      return NextResponse.json(
        { error: "No active organisation" },
        { status: 400 }
      );
    }

    const pool = getPool();
    const { rows } = await pool.query(
      `SELECT role FROM "member" WHERE "organizationId" = $1 AND "userId" = $2`,
      [orgId, user.id]
    );
    const role = rows[0]?.role;
    if (role !== "owner" && role !== "admin") {
      return NextResponse.json(
        { error: "Only PMs can perform this action" },
        { status: 403 }
      );
    }

    const body = await req.json();
    const email = body?.email;
    if (!email || typeof email !== "string") {
      return NextResponse.json({ error: "email is required" }, { status: 400 });
    }

    const cleared = await clearClientEmailByEmail(email);

    return NextResponse.json({ cleared });
  }
);
