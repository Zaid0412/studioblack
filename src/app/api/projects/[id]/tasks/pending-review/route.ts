import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { getTasksPendingReview, hasProjectAccess } from "@/lib/queries";

/** GET /api/projects/[id]/tasks/pending-review — tasks awaiting client review. */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const allowed = await hasProjectAccess(id, session.user.id, session.user.email, session.user.role);
  if (!allowed) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const tasks = await getTasksPendingReview(id);
  return NextResponse.json(tasks);
}
