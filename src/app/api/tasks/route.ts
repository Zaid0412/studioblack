import { NextResponse } from "next/server";
import { getTasks, getTaskBucketCounts, getMemberRole } from "@/lib/queries";
import { getPool } from "@/lib/db";
import { withAuth } from "@/lib/withAuth";
import { createNotification } from "@/lib/notifications";
import { sendNotificationEmail, escapeHtml } from "@/lib/email";
import { env } from "@/env";

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
    const phaseId = searchParams.get("phaseId") || undefined;
    const search = (searchParams.get("search") || undefined)?.slice(0, 200);
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(
      200,
      Math.max(1, parseInt(searchParams.get("limit") || "200", 10))
    );

    // Architects only see tasks assigned to them
    const memberRole = await getMemberRole(orgId, user.id);
    if (!memberRole) {
      return NextResponse.json({ tasks: [], counts: {}, total: 0 });
    }
    const isArchitect = memberRole === "member";

    const [taskResult, counts] = await Promise.all([
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
        assigneeOnly: isArchitect,
        projectId,
        status,
        priority,
        category,
        phaseId,
        search,
        page,
        limit,
      }),
      getTaskBucketCounts(orgId, user.id, isArchitect),
    ]);

    return NextResponse.json({
      tasks: taskResult.tasks,
      counts,
      total: taskResult.total,
      role: isArchitect ? "architect" : "pm",
    });
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

      // Email the assignee
      pool
        .query(`SELECT u.email, u.name FROM "user" u WHERE u.id = $1`, [
          assignedTo,
        ])
        .then(({ rows }) => {
          const r = rows[0];
          if (!r?.email) return;
          const subject = "New Task Assigned to You";
          const projectUrl = projectId
            ? escapeHtml(
                `${env().NEXT_PUBLIC_APP_URL}/projects/${encodeURIComponent(projectId)}`
              )
            : null;
          const body = `<p><strong>${escapeHtml(user.name || user.email)}</strong> assigned you a new task.</p>
            <p style="color: #666;">${escapeHtml(title.trim())}</p>
            ${projectUrl ? `<p style="margin-top: 16px;"><a href="${projectUrl}" style="color: #2563eb;">View Project →</a></p>` : ""}`;
          sendNotificationEmail(r.email, subject, body).catch(console.error);
        })
        .catch(console.error);
    }

    return NextResponse.json(task, { status: 201 });
  }
);
