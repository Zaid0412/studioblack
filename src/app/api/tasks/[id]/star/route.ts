import { NextResponse } from "next/server";
import { getPool } from "@/lib/db";
import { withAuth } from "@/lib/withAuth";

/** POST /api/tasks/[id]/star — toggle star on a task for the current user. */
export const POST = withAuth(
  { blockedRoles: ["client"] },
  async (_req, { user, orgId }, params) => {
    const pool = getPool();
    const taskId = params.id;

    // Check task exists and belongs to org
    const { rows: taskRows } = await pool.query(
      `SELECT id FROM task WHERE id = $1 AND ($2::text IS NULL OR org_id = $2)`,
      [taskId, orgId]
    );
    if (taskRows.length === 0) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // Atomic toggle using a transaction
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const { rowCount } = await client.query(
        "DELETE FROM task_star WHERE user_id = $1 AND task_id = $2",
        [user.id, taskId]
      );
      if (rowCount === 0) {
        await client.query(
          "INSERT INTO task_star (user_id, task_id) VALUES ($1, $2)",
          [user.id, taskId]
        );
        await client.query("COMMIT");
        return NextResponse.json({ starred: true });
      }
      await client.query("COMMIT");
      return NextResponse.json({ starred: false });
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  }
);
