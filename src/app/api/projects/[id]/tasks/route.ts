import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import {
  hasProjectAccess,
  getPhaseTasks,
  verifyPhaseOwnership,
  verifyTaskOwnership,
} from "@/lib/queries";
import { getPool } from "@/lib/db";
import { createNotification } from "@/lib/notifications";

const VALID_TASK_STATUSES = ["pending", "in_progress", "completed"];

/** GET /api/projects/[id]/tasks?phaseId=... — list tasks for a phase. */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const allowed = await hasProjectAccess(
    id,
    session.user.id,
    session.user.email,
    session.user.role
  );
  if (!allowed) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const phaseId = req.nextUrl.searchParams.get("phaseId");
  if (!phaseId) {
    return NextResponse.json({ error: "phaseId is required" }, { status: 400 });
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

/** POST /api/projects/[id]/tasks — create a sub-task (PM or assigned architect). */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const role = session.user.role;

  if (role === "client") {
    return NextResponse.json(
      { error: "Clients cannot create tasks" },
      { status: 403 }
    );
  }

  const allowed = await hasProjectAccess(
    id,
    session.user.id,
    session.user.email,
    role
  );
  if (!allowed) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { phaseId, title, description, assignedTo, dueDate } = await req.json();
  if (!phaseId || !title?.trim()) {
    return NextResponse.json(
      { error: "phaseId and title are required" },
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
  if (assignedTo && assignedTo !== session.user.id) {
    await createNotification({
      userId: assignedTo,
      type: "task_assigned",
      title: "New task assigned to you",
      description: `"${title.trim()}" has been assigned to you by ${session.user.name}`,
      projectId: id,
      taskId: task.id,
    }).catch(() => {});
  }

  return NextResponse.json(task, { status: 201 });
}

/** PATCH /api/projects/[id]/tasks — update a task. */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const role = session.user.role;

  if (role === "client") {
    return NextResponse.json(
      { error: "Clients cannot update tasks" },
      { status: 403 }
    );
  }

  const allowed = await hasProjectAccess(
    id,
    session.user.id,
    session.user.email,
    role
  );
  if (!allowed) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const {
    taskId,
    title,
    description,
    status,
    assignedTo,
    dueDate,
    requiresClientReview,
  } = await req.json();

  if (!taskId) {
    return NextResponse.json({ error: "taskId is required" }, { status: 400 });
  }

  const taskOwned = await verifyTaskOwnership(taskId, id);
  if (!taskOwned) {
    return NextResponse.json(
      { error: "Task not found in this project" },
      { status: 404 }
    );
  }

  if (status !== undefined && !VALID_TASK_STATUSES.includes(status)) {
    return NextResponse.json(
      {
        error: `Invalid status. Must be one of: ${VALID_TASK_STATUSES.join(", ")}`,
      },
      { status: 400 }
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
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
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
