import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { getProjectsByClientEmail } from "@/lib/queries";

/** GET /api/client/projects — list projects assigned to the current client by email. */
export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (session.user.role !== "client") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const projects = await getProjectsByClientEmail(session.user.email);
  return NextResponse.json(projects);
}
