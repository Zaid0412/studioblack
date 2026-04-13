import { NextResponse } from "next/server";
import { verifyTaskAccess, verifyTaskOwnership } from "@/lib/queries";

/**
 * Verify the task belongs to the user's org.
 * Returns the `taskId` on success, or a 404 NextResponse on failure.
 */
export async function guardTaskAccess(
  params: Record<string, string>,
  orgId: string | null
) {
  const taskId = params.id;
  if (!orgId || !(await verifyTaskAccess(taskId, orgId))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return taskId;
}

/**
 * Verify a task belongs to a specific project.
 * Returns `true` on success, or a 404 NextResponse on failure.
 */
export async function guardTaskOwnership(taskId: string, projectId: string) {
  const taskOwned = await verifyTaskOwnership(taskId, projectId);
  if (!taskOwned) {
    return NextResponse.json(
      { error: "Task not found in this project" },
      { status: 404 }
    );
  }
  return true;
}
