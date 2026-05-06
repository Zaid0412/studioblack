import { NextResponse } from "next/server";
import { getTaskActivity } from "@/lib/queries";
import { withAuth } from "@/lib/withAuth";

/**
 * GET /api/tasks/[id]/activity — merged comment + audit-event feed for the
 * task, ordered chronologically. Powers the timeline rail on /tasks/[id].
 *
 * Returns `{ events: [] }` when the task doesn't exist in the caller's
 * org — the underlying query filters by org_id + task_id, so missing
 * naturally produces an empty list (no extra existence pre-check).
 */
export const GET = withAuth(
  { blockedRoles: ["client"] },
  async (_req, { orgId }, params) => {
    if (!orgId) {
      return NextResponse.json({ error: "No organisation" }, { status: 403 });
    }
    const events = await getTaskActivity(params.id, orgId);
    return NextResponse.json({ events });
  }
);
