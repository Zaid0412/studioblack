import { NextResponse } from "next/server";
import { getTasks, getTaskBucketCounts } from "@/lib/queries";
import { getPool } from "@/lib/db";
import { withAuth } from "@/lib/withAuth";
import { createNotification } from "@/lib/notifications";

const VALID_PRIORITIES = ["low", "medium", "high", "urgent"];
const VALID_CATEGORIES = [
  "general",
  "design",
  "review",
  "revision",
  "production",
  "handover",
];
const VALID_BUCKETS = [
  "all",
  "my_tasks",
  "created_by_me",
  "starred",
  "upcoming",
  "completed",
];

/** GET /api/tasks — list tasks with smart bucket filters. */
export const GET = withAuth(
  { blockedRoles: ["client"] },
  async (req, { user, orgId }) => {
    if (!orgId) {
      return NextResponse.json({ tasks: [], counts: {} });
    }

    const { searchParams } = req.nextUrl;
    const bucket = searchParams.get("bucket") || "all";
    const projectId = searchParams.get("projectId") || undefined;
    const status = searchParams.get("status") || undefined;
    const priority = searchParams.get("priority") || undefined;
    const category = searchParams.get("category") || undefined;
    const search = (searchParams.get("search") || undefined)?.slice(0, 200);

    const [tasks, counts] = await Promise.all([
      getTasks({
        orgId,
        bucket: VALID_BUCKETS.includes(bucket)
          ? (bucket as
              | "all"
              | "my_tasks"
              | "created_by_me"
              | "starred"
              | "upcoming"
              | "completed")
          : "all",
        userId: user.id,
        projectId,
        status,
        priority,
        category,
        search,
      }),
      getTaskBucketCounts(orgId, user.id),
    ]);

    return NextResponse.json({ tasks, counts });
  }
);

/** POST /api/tasks — create a task. */
export const POST = withAuth(
  { blockedRoles: ["client"] },
  async (req, { user, orgId }) => {
    if (!orgId) {
      return NextResponse.json(
        { error: "No active organization" },
        { status: 400 }
      );
    }

    const body = await req.json();
    const {
      title,
      description,
      projectId,
      phaseId,
      priority,
      category,
      assignedTo,
      dueDate,
    } = body;

    if (!title?.trim()) {
      return NextResponse.json({ error: "Title is required" }, { status: 400 });
    }
    if (phaseId && !projectId) {
      return NextResponse.json(
        { error: "Phase requires a project" },
        { status: 400 }
      );
    }
    if (priority && !VALID_PRIORITIES.includes(priority)) {
      return NextResponse.json({ error: "Invalid priority" }, { status: 400 });
    }
    if (category && !VALID_CATEGORIES.includes(category)) {
      return NextResponse.json({ error: "Invalid category" }, { status: 400 });
    }

    const pool = getPool();

    // Validate assignedTo belongs to the org
    if (assignedTo) {
      const { rows } = await pool.query(
        'SELECT 1 FROM member WHERE "organizationId" = $1 AND "userId" = $2',
        [orgId, assignedTo]
      );
      if (rows.length === 0) {
        return NextResponse.json(
          { error: "Assignee not in organization" },
          { status: 400 }
        );
      }
    }

    // Validate projectId belongs to the org
    if (projectId) {
      const { rows } = await pool.query(
        "SELECT 1 FROM project WHERE id = $1 AND org_id = $2",
        [projectId, orgId]
      );
      if (rows.length === 0) {
        return NextResponse.json(
          { error: "Project not in organization" },
          { status: 400 }
        );
      }
    }

    const {
      rows: [task],
    } = await pool.query(
      `INSERT INTO task (org_id, project_id, phase_id, title, description, priority, category, created_by, assigned_to, due_date)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [
        orgId,
        projectId || null,
        phaseId || null,
        title.trim(),
        description || "",
        priority || "medium",
        category || "general",
        user.id,
        assignedTo || null,
        dueDate || null,
      ]
    );

    // Notify assignee if different from creator
    if (assignedTo && assignedTo !== user.id) {
      createNotification({
        userId: assignedTo,
        type: "task_assigned",
        title: "New task assigned to you",
        description: `"${title.trim()}" was assigned to you by ${user.name}`,
        projectId: projectId || undefined,
      }).catch((err) => console.error("Notification error:", err));
    }

    return NextResponse.json(task, { status: 201 });
  }
);
