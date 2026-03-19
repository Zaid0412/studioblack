import { NextResponse } from "next/server";
import { getPool } from "@/lib/db";
import { withAuth } from "@/lib/withAuth";

/** POST /api/tasks/[id]/star — toggle star on a task for the current user. */
export const POST = withAuth(
  { blockedRoles: ["client"] },
  async (_req, { user }, params) => {
    const pool = getPool();
    const taskId = params.id;

    // Check task exists
    const { rows: taskRows } = await pool.query(
      `SELECT id FROM task WHERE id = $1`,
      [taskId]
    );
    if (taskRows.length === 0) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // Toggle: delete if exists, insert if not
    const { rowCount } = await pool.query(
      `DELETE FROM task_star WHERE user_id = $1 AND task_id = $2`,
      [user.id, taskId]
    );

    if (rowCount === 0) {
      await pool.query(
        `INSERT INTO task_star (user_id, task_id) VALUES ($1, $2)`,
        [user.id, taskId]
      );
      return NextResponse.json({ starred: true });
    }

    return NextResponse.json({ starred: false });
  }
);
