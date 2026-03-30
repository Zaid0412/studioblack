import { NextResponse } from "next/server";
import { getPinComments, createPinComment, getAttachmentById, getPinCommentById } from "@/lib/queries";
import { getPool } from "@/lib/db";
import { withAuth } from "@/lib/withAuth";
import { rateLimit } from "@/lib/rateLimit";
import { createNotification } from "@/lib/notifications";

/** GET /api/projects/[id]/attachments/[attachmentId]/pins — list pin comments. */
export const GET = withAuth(
  { projectAccess: true },
  async (req, ctx, params) => {
    const { attachmentId } = params;

    const pins = await getPinComments(attachmentId);
    return NextResponse.json(pins);
  }
);

/** POST /api/projects/[id]/attachments/[attachmentId]/pins — create a pin comment. */
export const POST = withAuth(
  { projectAccess: true },
  async (req, { user }, params) => {
    const { allowed } = rateLimit(`pin:${user.id}`, {
      limit: 30,
      windowMs: 60_000,
    });
    if (!allowed) {
      return NextResponse.json(
        { error: "Too many requests. Please wait a moment." },
        { status: 429 }
      );
    }

    const { id, attachmentId } = params;

    // Verify attachment belongs to this project
    const attachment = await getAttachmentById(attachmentId, id);
    if (!attachment) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const body = await req.json();
    const { x_percent, y_percent, page, content, request_approval, assign_as_task } = body;

    // Coordinate validation: all-or-nothing
    const hasX = x_percent !== undefined && x_percent !== null;
    const hasY = y_percent !== undefined && y_percent !== null;
    const hasPage = page !== undefined && page !== null;
    const hasAnyCoord = hasX || hasY || hasPage;
    const hasAllCoords = hasX && hasY && hasPage;

    if (hasAnyCoord && !hasAllCoords) {
      return NextResponse.json(
        { error: "x_percent, y_percent, and page must all be provided together or all omitted" },
        { status: 400 }
      );
    }

    if (hasAllCoords) {
      if (typeof x_percent !== "number" || x_percent < 0 || x_percent > 100) {
        return NextResponse.json(
          { error: "x_percent must be a number between 0 and 100" },
          { status: 400 }
        );
      }
      if (typeof y_percent !== "number" || y_percent < 0 || y_percent > 100) {
        return NextResponse.json(
          { error: "y_percent must be a number between 0 and 100" },
          { status: 400 }
        );
      }
      if (!Number.isInteger(page) || page < 1) {
        return NextResponse.json(
          { error: "page must be a positive integer" },
          { status: 400 }
        );
      }
    }

    // Validate content
    if (typeof content !== "string" || !content.trim()) {
      return NextResponse.json(
        { error: "content must be a non-empty string" },
        { status: 400 }
      );
    }

    const xVal = hasAllCoords ? x_percent : null;
    const yVal = hasAllCoords ? y_percent : null;
    const pageVal = hasAllCoords ? page : null;
    const reqApproval = request_approval === true;

    // If assign_as_task is provided, use a transaction to create task + pin comment
    if (assign_as_task) {
      const { assigned_to, due_date } = assign_as_task;

      if (!assigned_to || typeof assigned_to !== "string") {
        return NextResponse.json(
          { error: "assign_as_task.assigned_to is required" },
          { status: 400 }
        );
      }

      const pool = getPool();
      const client = await pool.connect();

      try {
        await client.query("BEGIN");

        // Get org_id from the project
        const { rows: projRows } = await client.query(
          `SELECT org_id FROM project WHERE id = $1`,
          [id]
        );
        if (!projRows[0]) {
          await client.query("ROLLBACK");
          return NextResponse.json({ error: "Project not found" }, { status: 404 });
        }
        const orgId = projRows[0].org_id;

        // Truncate content for task title
        const taskTitle = content.trim().length > 100
          ? content.trim().slice(0, 97) + "..."
          : content.trim();

        // Create task
        const { rows: taskRows } = await client.query(
          `INSERT INTO task (org_id, project_id, title, created_by, assigned_to, due_date, status, priority, category)
           VALUES ($1, $2, $3, $4, $5, $6, 'todo', 'medium', 'review')
           RETURNING id`,
          [
            orgId,
            id,
            taskTitle,
            user.id,
            assigned_to,
            due_date || null,
          ]
        );
        const taskId = taskRows[0].id;

        // Create pin comment linked to task
        const { rows: pinRows } = await client.query(
          `INSERT INTO pin_comment (attachment_id, user_id, x_percent, y_percent, page, content, request_approval, task_id)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
           RETURNING *`,
          [
            attachmentId,
            user.id,
            xVal,
            yVal,
            pageVal,
            content.trim(),
            reqApproval,
            taskId,
          ]
        );

        await client.query("COMMIT");

        // Notify assignee (fire-and-forget, outside transaction)
        if (assigned_to !== user.id) {
          createNotification({
            userId: assigned_to,
            type: "task_assigned",
            title: "New task assigned to you",
            description: `"${taskTitle}" was assigned to you by ${user.name}`,
            projectId: id,
            taskId,
          });
        }

        // Re-fetch with user name
        const pin = await getPinCommentById(pinRows[0].id);
        return NextResponse.json(pin, { status: 201 });
      } catch (err) {
        await client.query("ROLLBACK");
        throw err;
      } finally {
        client.release();
      }
    }

    // Standard path: no task creation
    const pin = await createPinComment({
      attachmentId,
      userId: user.id,
      xPercent: xVal,
      yPercent: yVal,
      page: pageVal,
      content: content.trim(),
      requestApproval: reqApproval,
    });

    return NextResponse.json(pin, { status: 201 });
  }
);
