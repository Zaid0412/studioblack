import { NextResponse } from "next/server";
import { verifyTaskAccess, toggleTaskStar } from "@/lib/queries";
import { withAuth } from "@/lib/withAuth";

/** POST /api/tasks/[id]/star — toggle star on a task for the current user. */
export const POST = withAuth(
  { blockedRoles: ["client"] },
  async (_req, { user, orgId }, params) => {
    const taskId = params.id;

    if (!(await verifyTaskAccess(taskId, orgId))) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const result = await toggleTaskStar(user.id, taskId);
    return NextResponse.json(result);
  }
);
