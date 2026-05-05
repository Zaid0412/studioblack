import { NextResponse } from "next/server";
import {
  getTasks,
  getTaskBucketCounts,
  getMemberRole,
  validateOrgMembership,
  validateProjectInOrg,
  createTask,
} from "@/lib/queries";
import { withAuth } from "@/lib/withAuth";
import {
  createNotification,
  notifyUserByEmailWithContext,
} from "@/lib/notifications";
import { escapeHtml } from "@/lib/email";
import { env } from "@/env";
import {
  parseRequest,
  createTaskSchema,
  TASK_BUCKETS,
  type TaskBucket,
} from "@/lib/validations";
import { logger } from "@/lib/logger";

const VALID_BUCKETS: ReadonlySet<string> = new Set(TASK_BUCKETS);

/** GET /api/tasks — list tasks with smart bucket filters. */
export const GET = withAuth(
  { blockedRoles: ["client"] },
  async (req, { user, orgId }) => {
    if (!orgId) {
      return NextResponse.json({ tasks: [], counts: {} });
    }

    const { searchParams } = req.nextUrl;
    const bucket = searchParams.get("bucket") || "all_tasks";
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

    const resolvedBucket: TaskBucket = VALID_BUCKETS.has(bucket)
      ? (bucket as TaskBucket)
      : "all_tasks";

    const [taskResult, counts] = await Promise.all([
      getTasks({
        orgId,
        bucket: resolvedBucket,
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

    const parsed = await parseRequest(req, createTaskSchema);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }
    const {
      title,
      description,
      projectId,
      phaseId,
      priority,
      category,
      assignedTo,
      dueDate,
    } = parsed.data;

    if (phaseId && !projectId) {
      return NextResponse.json(
        { error: "Phase requires a project" },
        { status: 400 }
      );
    }

    // Validate assignedTo belongs to the org
    if (assignedTo) {
      if (!(await validateOrgMembership(orgId, assignedTo))) {
        return NextResponse.json(
          { error: "Assignee not in organization" },
          { status: 400 }
        );
      }
    }

    // Validate projectId belongs to the org
    if (projectId) {
      if (!(await validateProjectInOrg(projectId, orgId))) {
        return NextResponse.json(
          { error: "Project not in organization" },
          { status: 400 }
        );
      }
    }

    const task = await createTask({
      orgId,
      projectId: projectId || null,
      phaseId: phaseId || null,
      title: title.trim(),
      description: description || "",
      priority: priority || "medium",
      category: category || "general",
      createdBy: user.id,
      assignedTo: assignedTo || user.id,
      dueDate: dueDate || null,
    });

    // Notify assignee if different from creator
    if (assignedTo && assignedTo !== user.id) {
      createNotification({
        userId: assignedTo,
        type: "task_assigned",
        title: "New task assigned to you",
        description: `"${title.trim()}" was assigned to you by ${user.name}`,
        projectId: projectId || undefined,
      }).catch((err) =>
        logger.error("Task assignment notification failed", { error: err })
      );

      // Email the assignee
      notifyUserByEmailWithContext(assignedTo, projectId || null, (ctx) => {
        const projectUrl = projectId
          ? escapeHtml(
              `${env().NEXT_PUBLIC_APP_URL}/projects/${encodeURIComponent(projectId)}`
            )
          : null;
        return {
          subject: ctx.projectName
            ? `${ctx.projectName} | New Task Assigned to You`
            : "New Task Assigned to You",
          html: `<p><strong>${escapeHtml(user.name || user.email)}</strong> assigned you a new task.</p>
            <p style="color: #666;">${escapeHtml(title.trim())}</p>
            ${projectUrl ? `<p style="margin-top: 16px;"><a href="${projectUrl}" style="color: #2563eb;">View Project →</a></p>` : ""}`,
        };
      });
    }

    return NextResponse.json(task, { status: 201 });
  }
);
