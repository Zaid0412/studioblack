import { NextResponse } from "next/server";
import {
  getPhaseTasks,
  verifyPhaseOwnership,
  verifyTaskOwnership,
} from "@/lib/queries";
import { getPool } from "@/lib/db";
import { createNotification } from "@/lib/notifications";
import { withAuth } from "@/lib/withAuth";
import {
  parseBody,
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

    const raw = await req.json();
    const parsed = parseBody(createPhaseTaskSchema, raw);
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

    const pool = getPool();
    const {
      rows: [task],
    } = await pool.query(
      `INSERT INTO phase_task (phase_id, title, description, assigned_to, due_date)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
      [
        phaseId,
        title.trim(),
        description || "",
        assignedTo || null,
        dueDate || null,
      ]
    );

    // Notify the assignee if someone else created the task
    if (assignedTo && assignedTo !== user.id) {
      await createNotification({
        userId: assignedTo,
        type: "task_assigned",
        title: "New task assigned to you",
        description: `"${title.trim()}" has been assigned to you by ${user.name}`,
        projectId: id,
        taskId: task.id,
      }).catch(() => {});
    }

    return NextResponse.json(task, { status: 201 });
  }
);

/** PATCH /api/projects/[id]/tasks — update a task. */
export const PATCH = withAuth(
  { blockedRoles: ["client"], projectAccess: true },
  async (req, _ctx, params) => {
    const { id } = params;

    const raw = await req.json();
    const parsed = parseBody(updatePhaseTaskSchema, raw);
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

    const pool = getPool();
    const updates: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    const fields: Record<string, unknown> = {
      title,
      description,
      status,
      assigned_to: assignedTo,
      due_date: dueDate,
      requires_client_review: requiresClientReview,
    };

    for (const [col, val] of Object.entries(fields)) {
      if (val !== undefined) {
        updates.push(`${col} = $${idx}`);
        values.push(val);
        idx++;
      }
    }

    if (updates.length === 0) {
      return NextResponse.json(
        { error: "No fields to update" },
        { status: 400 }
      );
    }

    updates.push(`updated_at = now()`);
    values.push(taskId);

    const {
      rows: [updated],
    } = await pool.query(
      `UPDATE phase_task SET ${updates.join(", ")} WHERE id = $${idx} RETURNING *`,
      values
    );

    return NextResponse.json(updated);
  }
);
