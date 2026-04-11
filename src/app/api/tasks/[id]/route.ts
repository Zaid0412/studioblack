import { NextResponse } from "next/server";
import { getTaskById } from "@/lib/queries";
import { getPool } from "@/lib/db";
import { withAuth } from "@/lib/withAuth";
import { createNotification } from "@/lib/notifications";
import { sendNotificationEmail, escapeHtml } from "@/lib/email";
import { env } from "@/env";
import { parseBody, updateTaskSchema } from "@/lib/validations";

/** GET /api/tasks/[id] — get a single task. */
export const GET = withAuth(
  { blockedRoles: ["client"] },
  async (_req, { user, orgId }, params) => {
    const task = await getTaskById(params.id, {
      userId: user.id,
      orgId: orgId ?? undefined,
    });
    if (!task) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json(task);
  }
);

/** PATCH /api/tasks/[id] — update a task. */
export const PATCH = withAuth(
  { blockedRoles: ["client"] },
  async (req, { user, orgId }, params) => {
    try {
      const task = await getTaskById(params.id, { orgId: orgId ?? undefined });
      if (!task) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
      }

      const raw = await req.json();
      const parsed = parseBody(updateTaskSchema, raw);
      if (!parsed.success) {
        return NextResponse.json({ error: parsed.error }, { status: 400 });
      }
      const body = parsed.data;
      const pool = getPool();

      // Validate assignedTo belongs to the same org
      if (body.assignedTo && orgId) {
        const { rows } = await pool.query(
          'SELECT 1 FROM member WHERE "organizationId" = $1 AND "userId" = $2',
          [orgId, body.assignedTo]
        );
        if (rows.length === 0) {
          return NextResponse.json(
            { error: "Assignee not in organization" },
            { status: 400 }
          );
        }
      }

      // Validate projectId belongs to the same org
      if (body.projectId && orgId) {
        const { rows } = await pool.query(
          "SELECT 1 FROM project WHERE id = $1 AND org_id = $2",
          [body.projectId, orgId]
        );
        if (rows.length === 0) {
          return NextResponse.json(
            { error: "Project not in organization" },
            { status: 400 }
          );
        }
      }
      const updates: string[] = [];
      const values: unknown[] = [];
      let idx = 1;

      const fields: Record<string, unknown> = {
        title: body.title,
        description: body.description,
        status: body.status,
        priority: body.priority,
        category: body.category,
        assigned_to: body.assignedTo,
        project_id: body.projectId,
        phase_id: body.phaseId,
        due_date: body.dueDate,
        reminder_at: body.reminderAt,
      };

      for (const [col, value] of Object.entries(fields)) {
        if (value !== undefined) {
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
        }).catch((err) => console.error("Notification error:", err));

        // Email the new assignee
        pool
          .query(`SELECT u.email, u.name FROM "user" u WHERE u.id = $1`, [
            body.assignedTo,
          ])
          .then(({ rows }) => {
            const r = rows[0];
            if (!r?.email) return;
            const subject = "Task Assigned to You";
            const projectUrl = updated?.project_id
              ? escapeHtml(
                  `${env().NEXT_PUBLIC_APP_URL}/projects/${encodeURIComponent(updated.project_id)}`
                )
              : null;
            const emailBody = `<p><strong>${escapeHtml(user.name || user.email)}</strong> assigned you a task.</p>
              <p style="color: #666;">${escapeHtml(updated?.title || "")}</p>
              ${projectUrl ? `<p style="margin-top: 16px;"><a href="${projectUrl}" style="color: #2563eb;">View Project →</a></p>` : ""}`;
            sendNotificationEmail(r.email, subject, emailBody).catch(
              console.error
            );
          })
          .catch(console.error);
      }

      return NextResponse.json(updated);
    } catch (err) {
      console.error("Task PATCH error:", err);
      return NextResponse.json(
        { error: "Failed to update task" },
        { status: 500 }
      );
    }
  }
);

/** DELETE /api/tasks/[id] — delete a task. */
export const DELETE = withAuth(
  { blockedRoles: ["client"] },
  async (_req, { user, orgId }, params) => {
    const task = await getTaskById(params.id, { orgId: orgId ?? undefined });
    if (!task) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const pool = getPool();

    // Only creator or org owner/admin can delete
    if (task.created_by !== user.id) {
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

    await pool.query(`DELETE FROM task WHERE id = $1`, [params.id]);
    return NextResponse.json({ success: true });
  }
);
