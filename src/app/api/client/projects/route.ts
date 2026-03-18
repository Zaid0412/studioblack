import { NextResponse } from "next/server";
import { getProjectsByClientEmail } from "@/lib/queries";
import { withAuth } from "@/lib/withAuth";

/** GET /api/client/projects — list projects assigned to the current client by email. */
export const GET = withAuth(
  { allowedRoles: ["client"] },
  async (req, { user }) => {
    const projects = await getProjectsByClientEmail(user.email);
    return NextResponse.json(projects);
  }
);
