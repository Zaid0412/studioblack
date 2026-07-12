import { NextResponse } from "next/server";
import {
  getPhaseTasks,
  verifyPhaseOwnership,
  verifyTaskOwnership,
  createPhaseTask,
  updatePhaseTask,
} from "@/lib/queries";
import {
  createNotification,
  notifyUserByEmailWithContext,
} from "@/lib/notifications";
import { escapeHtml } from "@/lib/email";
import { env } from "@/env";
import { withAuth } from "@/lib/withAuth";
import {
  parseRequest,
  createPhaseTaskSchema,
  updatePhaseTaskSchema,
} from "@/lib/validations";

/** GET /api/projects/[id]/tasks?phaseId=... — list tasks for a phase. */
export const GET = withAuth(
  { projectAccess: true },
  async (req, _ctx, params) => {
    const { id } = params;

    const phaseId = req.nextUrl.searchParams.get("phaseId");
    if (!phaseId) {
      return NextResponse.json(
        { error: "phaseId is required" },
        { status: 400 }
      );
    }

    const phaseOwned = await verifyPhaseOwnership(phaseId, id);
    if (!phaseOwned) {
      return NextResponse.json(
        { error: "Phase not found in this project" },
        { status: 404 }
      );
    }

    const tasks = await getPhaseTasks(phaseId, id);
    return NextResponse.json(tasks);
  }
);

/** POST /api/projects/[id]/tasks — create a sub-task (PM or assigned architect). */
export const POST = withAuth(
  { blockedRoles: ["client"], projectAccess: true },
  async (req, { user }, params) => {
    const { id } = params;

    const parsed = await parseRequest(req, createPhaseTaskSchema);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }
    const { phaseId, title, description, assignedTo, dueDate } = parsed.data;

    const phaseOwned = await verifyPhaseOwnership(phaseId, id);
    if (!phaseOwned) {
      return NextResponse.json(
        { error: "Phase not found in this project" },
        { status: 404 }
      );
    }

    const task = await createPhaseTask({
      phaseId,
      title: title.trim(),
      description: description || "",
      assignedTo: assignedTo || null,
      dueDate: dueDate || null,
    });

    // Notify the assignee if someone else created the task
    if (assignedTo && assignedTo !== user.id) {
      await createNotification({
        userId: assignedTo,
        type: "task_assigned",
        title: "New task assigned to you",
        description: `"${title.trim()}" has been assigned to you by ${user.name}`,
        projectId: id,
        phaseTaskId: task.id,
      }).catch(() => {});

      notifyUserByEmailWithContext(assignedTo, id, (ctx) => {
        const projectUrl = escapeHtml(
          `${env().NEXT_PUBLIC_APP_URL}/projects/${encodeURIComponent(id)}`
        );
        return {
          subject: ctx.projectName
            ? `${ctx.projectName} | New Task Assigned to You`
            : "New Task Assigned to You",
          html: `<p><strong>${escapeHtml(user.name || user.email)}</strong> assigned you a new task.</p>
            <p style="color: #666;">${escapeHtml(title.trim())}</p>
            <p style="margin-top: 16px;"><a href="${projectUrl}" style="color: #2563eb;">View Project →</a></p>`,
        };
      });
    }

    return NextResponse.json(task, { status: 201 });
  }
);

/** PATCH /api/projects/[id]/tasks — update a task. */
export const PATCH = withAuth(
  { blockedRoles: ["client"], projectAccess: true },
  async (req, _ctx, params) => {
    const { id } = params;

    const parsed = await parseRequest(req, updatePhaseTaskSchema);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }
    const {
      taskId,
      title,
      description,
      status,
      assignedTo,
      dueDate,
      requiresClientReview,
    } = parsed.data;

    const taskOwned = await verifyTaskOwnership(taskId, id);
    if (!taskOwned) {
      return NextResponse.json(
        { error: "Task not found in this project" },
        { status: 404 }
      );
    }

    const fields: Record<string, unknown> = {
      title,
      description,
      status,
      assigned_to: assignedTo,
      due_date: dueDate,
      requires_client_review: requiresClientReview,
    };

    const updated = await updatePhaseTask(taskId, fields);

    if (!updated) {
      return NextResponse.json(
        { error: "No fields to update" },
        { status: 400 }
      );
    }

    return NextResponse.json(updated);
  }
);
