import { NextResponse } from "next/server";
import {
  getTaskById,
  validateOrgMembership,
  validateProjectInOrg,
  updateTask,
  getMemberRole,
  deleteTask,
  logTaskFieldChanges,
} from "@/lib/queries";
import { withAuth } from "@/lib/withAuth";
import {
  createNotification,
  notifyUserByEmailWithContext,
} from "@/lib/notifications";
import { escapeHtml } from "@/lib/email";
import { env } from "@/env";
import { parseRequest, updateTaskSchema } from "@/lib/validations";
import { logger } from "@/lib/logger";

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

      const parsed = await parseRequest(req, updateTaskSchema);
      if (!parsed.success) {
        return NextResponse.json({ error: parsed.error }, { status: 400 });
      }
      const body = parsed.data;

      // Validate assignedTo belongs to the same org
      if (body.assignedTo && orgId) {
        if (!(await validateOrgMembership(orgId, body.assignedTo))) {
          return NextResponse.json(
            { error: "Assignee not in organization" },
            { status: 400 }
          );
        }
      }

      // Validate projectId belongs to the same org
      if (body.projectId && orgId) {
        if (!(await validateProjectInOrg(body.projectId, orgId))) {
          return NextResponse.json(
            { error: "Project not in organization" },
            { status: 400 }
          );
        }
      }

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

      // Determine completed_at transition
      let completedAtTransition: "set" | "clear" | undefined;
      if (body.status === "completed" && task.status !== "completed") {
        completedAtTransition = "set";
      } else if (
        body.status &&
        body.status !== "completed" &&
        task.status === "completed"
      ) {
        completedAtTransition = "clear";
      }

      const updated = await updateTask(params.id, fields, {
        completedAtTransition,
      });

      if (!updated) {
        return NextResponse.json(
          { error: "No fields to update" },
          { status: 400 }
        );
      }

      // Write audit events for any tracked-field changes — surfaces in the
      // /tasks/[id] timeline rail. Fire-and-forget; never blocks the response.
      // Refetch with joined names so the audit metadata captures display
      // names alongside IDs (timeline keeps reading correctly even if the
      // assignee / project / phase is later renamed or deleted).
      if (orgId) {
        getTaskById(params.id, { orgId })
          .then((updatedJoined) => {
            if (!updatedJoined) return;
            return logTaskFieldChanges({
              orgId,
              actorId: user.id,
              taskId: params.id,
              before: task as unknown as Record<string, unknown>,
              after: updatedJoined as unknown as Record<string, unknown>,
            });
          })
          .catch((err) =>
            logger.warn("Task audit write failed", {
              taskId: params.id,
              error: String(err),
            })
          );
      }

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
        }).catch((err) =>
          logger.error("Task assignment notification failed", {
            taskId: params.id,
            error: err,
          })
        );

        // Email the new assignee
        notifyUserByEmailWithContext(
          body.assignedTo,
          updated?.project_id || null,
          (ctx) => {
            const projectUrl = updated?.project_id
              ? escapeHtml(
                  `${env().NEXT_PUBLIC_APP_URL}/projects/${encodeURIComponent(updated.project_id)}`
                )
              : null;
            return {
              subject: ctx.projectName
                ? `${ctx.projectName} | Task Assigned to You`
                : "Task Assigned to You",
              html: `<p><strong>${escapeHtml(user.name || user.email)}</strong> assigned you a task.</p>
              <p style="color: #666;">${escapeHtml(updated?.title || "")}</p>
              ${projectUrl ? `<p style="margin-top: 16px;"><a href="${projectUrl}" style="color: #2563eb;">View Project →</a></p>` : ""}`,
            };
          }
        );
      }

      return NextResponse.json(updated);
    } catch (err) {
      logger.error("Task PATCH error", { taskId: params.id, error: err });
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

    // Only creator or org owner/admin can delete
    if (task.created_by !== user.id) {
      const role = await getMemberRole(task.org_id, user.id);
      if (role !== "owner" && role !== "admin") {
        return NextResponse.json(
          { error: "Only task creator or PMs can delete tasks" },
          { status: 403 }
        );
      }
    }

    await deleteTask(params.id);
    return NextResponse.json({ success: true });
  }
);
