import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { getTasksByAssignee } from "@/lib/queries";

/** GET /api/user/tasks — all tasks assigned to the current user. */
export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (session.user.role === "client") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const tasks = await getTasksByAssignee(session.user.id);
  return NextResponse.json(tasks);
}
