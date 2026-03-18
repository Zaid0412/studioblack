import { NextResponse } from "next/server";
import { getTasksByAssignee } from "@/lib/queries";
import { withAuth } from "@/lib/withAuth";

/** GET /api/user/tasks — all tasks assigned to the current user. */
export const GET = withAuth(
  { blockedRoles: ["client"] },
  async (req, { user }) => {
    const tasks = await getTasksByAssignee(user.id);
    return NextResponse.json(tasks);
  }
);
