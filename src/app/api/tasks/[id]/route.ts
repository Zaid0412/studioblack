import { NextResponse } from "next/server";
import { getTaskById } from "@/lib/queries";
import { getPool } from "@/lib/db";
import { withAuth } from "@/lib/withAuth";
import { createNotification } from "@/lib/notifications";

const VALID_STATUSES = ["todo", "in_progress", "completed", "archived"];
const VALID_PRIORITIES = ["low", "medium", "high", "urgent"];
const VALID_CATEGORIES = [
  "general",
  "design",
  "review",
  "revision",
  "production",
  "handover",
];

/** GET /api/tasks/[id] — get a single task. */
export const GET = withAuth(
  { blockedRoles: ["client"] },
  async (_req, { user }, params) => {
    const task = await getTaskById(params.id, user.id);
    if (!task) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json(task);
  }
);

/** PATCH /api/tasks/[id] — update a task. */
export const PATCH = withAuth(
  { blockedRoles: ["client"] },
  async (req, { user }, params) => {
    try {
      const task = await getTaskById(params.id);
      if (!task) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
      }

      const body = await req.json();
      const pool = getPool();
      const updates: string[] = [];
      const values: unknown[] = [];
      let idx = 1;

      const fields: Record<
        string,
        { value: unknown; validate?: () => boolean }
      > = {
        title: {
          value: body.title?.trim(),
          validate: () => !!body.title?.trim(),
        },
        description: { value: body.description },
        status: {
          value: body.status,
          validate: () => VALID_STATUSES.includes(body.status),
        },
        priority: {
          value: body.priority,
          validate: () => VALID_PRIORITIES.includes(body.priority),
        },
        category: {
          value: body.category,
          validate: () => VALID_CATEGORIES.includes(body.category),
        },
        assigned_to: { value: body.assignedTo },
        project_id: { value: body.projectId },
        phase_id: { value: body.phaseId },
        due_date: { value: body.dueDate },
        reminder_at: { value: body.reminderAt },
      };

      for (const [col, { value, validate }] of Object.entries(fields)) {
        if (value !== undefined) {
          if (validate && !validate()) {
            return NextResponse.json(
              { error: `Invalid ${col}` },
              { status: 400 }
            );
          }
          updates.push(`${col} = $${idx}`);
          values.push(value === "" ? null : value);
          idx++;
        }
      }

      // Handle completed_at automatically
      if (body.status === "completed" && task.status !== "completed") {
        updates.push(`completed_at = now()`);
      } else if (
        body.status &&
        body.status !== "completed" &&
        task.status === "completed"
      ) {
        updates.push(`completed_at = NULL`);
      }

      if (updates.length === 0) {
        return NextResponse.json(
          { error: "No fields to update" },
          { status: 400 }
        );
      }

      updates.push(`updated_at = now()`);
      values.push(params.id);

      const {
        rows: [updated],
      } = await pool.query(
        `UPDATE task SET ${updates.join(", ")} WHERE id = $${idx} RETURNING *`,
        values
      );

      // Notify new assignee if changed
      if (
        body.assignedTo &&
        body.assignedTo !== task.assigned_to &&
        body.assignedTo !== user.id
      ) {
        createNotification({
          userId: body.assignedTo,
          type: "task_assigned",
          title: "Task assigned to you",
          description: `"${updated?.title}" was assigned to you by ${user.name}`,
          projectId: updated?.project_id || undefined,
        }).catch(() => {});
      }

      return NextResponse.json(updated);
    } catch (err) {
      console.error("Task PATCH error:", err);
      return NextResponse.json(
        {
          error: err instanceof Error ? err.message : "Failed to update task",
        },
        { status: 500 }
      );
    }
  }
);

/** DELETE /api/tasks/[id] — delete a task. */
export const DELETE = withAuth(
  { blockedRoles: ["client"] },
  async (_req, { user }, params) => {
    const task = await getTaskById(params.id);
    if (!task) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // Only creator or org owner/admin can delete
    if (task.created_by !== user.id) {
      const pool = getPool();
      const { rows } = await pool.query(
        `SELECT role FROM member WHERE "organizationId" = $1 AND "userId" = $2`,
        [task.org_id, user.id]
      );
      const role = rows[0]?.role;
      if (role !== "owner" && role !== "admin") {
        return NextResponse.json(
          { error: "Only task creator or PMs can delete tasks" },
          { status: 403 }
        );
      }
    }

    const pool = getPool();
    await pool.query(`DELETE FROM task WHERE id = $1`, [params.id]);
    return NextResponse.json({ success: true });
  }
);
