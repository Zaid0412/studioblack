import { NextResponse } from "next/server";
import { withAuth } from "@/lib/withAuth";
import { clearClientEmailByEmail } from "@/lib/queries";

/**
 * POST /api/org/clear-client
 *
 * When a client member is removed from the org, clear their client_email
 * from all assigned projects. PM-only.
 */
export const POST = withAuth(
  { blockedRoles: ["client"], fetchOrgRole: true },
  async (req, { orgRole }) => {
    if (!orgRole || (orgRole !== "owner" && orgRole !== "admin")) {
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
