import { NextResponse } from "next/server";
import { getTaskById, getTaskActivity } from "@/lib/queries";
import { withAuth } from "@/lib/withAuth";

/**
 * GET /api/tasks/[id]/activity — merged comment + audit-event feed for the
 * task, ordered chronologically. Powers the timeline rail on /tasks/[id].
 */
export const GET = withAuth(
  { blockedRoles: ["client"] },
  async (_req, { orgId }, params) => {
    if (!orgId) {
      return NextResponse.json({ error: "No organisation" }, { status: 403 });
    }
    const task = await getTaskById(params.id, { orgId });
    if (!task) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const events = await getTaskActivity(params.id, orgId);
    return NextResponse.json({ events });
  }
);
