import { NextResponse } from "next/server";
import {
  getPinComments,
  createPinComment,
  getAttachmentById,
  getPinCommentById,
} from "@/lib/queries";
import { getPool } from "@/lib/db";
import { withAuth } from "@/lib/withAuth";
import { rateLimit } from "@/lib/rateLimit";
import { sendNotificationEmail, escapeHtml } from "@/lib/email";
import { env } from "@/env";
import {
  createNotification,
  createNotificationsForTeam,
} from "@/lib/notifications";
import { parseBody, createPinSchema } from "@/lib/validations";

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

    const raw = await req.json();
    const parsed = parseBody(createPinSchema, raw);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }
    const {
      x_percent,
      y_percent,
      page,
      content,
      request_changes,
      assign_as_task,
      parent_id,
    } = parsed.data;

    // If this is a reply, validate parent exists and belongs to same attachment
    if (parent_id) {
      const parent = await getPinCommentById(parent_id);
      if (!parent || parent.attachment_id !== attachmentId) {
        return NextResponse.json(
          { error: "Parent comment not found" },
          { status: 404 }
        );
      }
      const reply = await createPinComment({
        attachmentId,
        userId: user.id,
        xPercent: null,
        yPercent: null,
        page: null,
        content: content.trim(),
        parentId: parent_id,
      });
      return NextResponse.json(reply, { status: 201 });
    }

    // Coordinate validation: all-or-nothing
    const hasX = x_percent !== undefined && x_percent !== null;
    const hasY = y_percent !== undefined && y_percent !== null;
    const hasPage = page !== undefined && page !== null;
    const hasAnyCoord = hasX || hasY || hasPage;
    const hasAllCoords = hasX && hasY && hasPage;

    if (hasAnyCoord && !hasAllCoords) {
      return NextResponse.json(
        {
          error:
            "x_percent, y_percent, and page must all be provided together or all omitted",
        },
        { status: 400 }
      );
    }

    const xVal = hasAllCoords ? x_percent : null;
    const yVal = hasAllCoords ? y_percent : null;
    const pageVal = hasAllCoords ? page : null;
    const reqChanges = request_changes === true;

    // Shared helper: create a task + pin comment in a single transaction
    const needsTask = assign_as_task || (reqChanges && !assign_as_task);
    if (needsTask) {
      const assignedTo = assign_as_task
        ? assign_as_task.assigned_to
        : attachment.uploaded_by;
      const dueDate = assign_as_task?.due_date || null;

      const pool = getPool();
      const client = await pool.connect();

      try {
        await client.query("BEGIN");

        const { rows: projRows } = await client.query(
          `SELECT org_id FROM project WHERE id = $1`,
          [id]
        );
        if (!projRows[0]) {
          await client.query("ROLLBACK");
          return NextResponse.json(
            { error: "Project not found" },
            { status: 404 }
          );
        }
        const orgId = projRows[0].org_id;

        const taskTitle =
          content.trim().length > 100
            ? content.trim().slice(0, 97) + "..."
            : content.trim();

        const { rows: taskRows } = await client.query(
          `INSERT INTO task (org_id, project_id, title, created_by, assigned_to, due_date, status, priority, category)
           VALUES ($1, $2, $3, $4, $5, $6, 'todo', 'medium', 'review')
           RETURNING id`,
          [orgId, id, taskTitle, user.id, assignedTo, dueDate]
        );
        const taskId = taskRows[0].id;

        const { rows: pinRows } = await client.query(
          `INSERT INTO pin_comment (attachment_id, user_id, x_percent, y_percent, page, content, request_approval, request_changes, task_id)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
           RETURNING *`,
          [
            attachmentId,
            user.id,
            xVal,
            yVal,
            pageVal,
            content.trim(),
            false,
            reqChanges,
            taskId,
          ]
        );

        // Request changes: also reject the attachment
        if (reqChanges) {
          await client.query(
            `UPDATE attachment SET review_status = 'rejected', reviewed_by = $1 WHERE id = $2`,
            [user.id, attachmentId]
          );
        }

        await client.query("COMMIT");

        // Notify assignee (fire-and-forget, outside transaction)
        if (assignedTo !== user.id) {
          const notifTitle = reqChanges
            ? "Changes requested on your design"
            : "New task assigned to you";
          const notifDesc = reqChanges
            ? `"${taskTitle}" — changes requested by ${user.name}`
            : `"${taskTitle}" was assigned to you by ${user.name}`;
          createNotification({
            userId: assignedTo,
            type: "task_assigned",
            title: notifTitle,
            description: notifDesc,
            projectId: id,
            taskId,
          });

          // Email the assignee
          pool
            .query(
              `SELECT u.email, u.name, p.name AS project_name
               FROM "user" u
               JOIN project p ON p.id = $2
               WHERE u.id = $1`,
              [assignedTo, id]
            )
            .then(({ rows }) => {
              const r = rows[0];
              if (!r?.email) return;
              const projectUrl = escapeHtml(
                `${env().NEXT_PUBLIC_APP_URL}/projects/${encodeURIComponent(id)}`
              );
              const subject = reqChanges
                ? `Changes Requested: ${r.project_name}`
                : `New Task Assigned: ${r.project_name}`;
              const body = reqChanges
                ? `<p><strong>${escapeHtml(user.name || user.email)}</strong> requested changes on your design in <strong>${escapeHtml(r.project_name)}</strong>.</p>
                   <p style="color: #666;">${escapeHtml(taskTitle)}</p>
                   <p style="margin-top: 16px;"><a href="${projectUrl}" style="color: #2563eb;">View Project →</a></p>`
                : `<p><strong>${escapeHtml(user.name || user.email)}</strong> assigned you a task in <strong>${escapeHtml(r.project_name)}</strong>.</p>
                   <p style="color: #666;">${escapeHtml(taskTitle)}</p>
                   <p style="margin-top: 16px;"><a href="${projectUrl}" style="color: #2563eb;">View Project →</a></p>`;
              sendNotificationEmail(r.email, subject, body).catch(
                console.error
              );
            })
            .catch(console.error);
        }

        // Notify the rest of the team when changes are requested (fire-and-forget)
        if (reqChanges) {
          const safeReviewer = escapeHtml(user.name || user.email);

          // In-app notifications for all team members (except the client)
          createNotificationsForTeam(
            id,
            user.id,
            "review_changes_requested",
            `${user.name || "Client"} requested changes on "${attachment.file_name}"`,
            taskTitle
          );

          // Email the rest of the team (excluding assignee who was already emailed above)
          pool
            .query(
              `SELECT DISTINCT u.email, u.name, p.name AS project_name
               FROM project p
               JOIN member m ON m."organizationId" = p.org_id
               JOIN "user" u ON u.id = m."userId"
               WHERE p.id = $1 AND m."userId" != $2 AND m."userId" != $3`,
              [id, user.id, assignedTo]
            )
            .then(({ rows: teamMembers }) => {
              const projectUrl = escapeHtml(
                `${env().NEXT_PUBLIC_APP_URL}/projects/${encodeURIComponent(id)}`
              );
              const safeFileName = escapeHtml(attachment.file_name);
              const safeComment = `<p style="color:#555;margin-top:12px;">"${escapeHtml(taskTitle)}"</p>`;

              for (const member of teamMembers) {
                const subject = `Changes Requested: ${attachment.file_name}`;
                const body = `<p><strong>${safeReviewer}</strong> requested changes on <strong>${safeFileName}</strong>.</p>${safeComment}<p style="margin-top:16px;"><a href="${projectUrl}" style="color: #2563eb;">View Project →</a></p>`;
                sendNotificationEmail(member.email, subject, body).catch(
                  console.error
                );
              }
            })
            .catch(console.error);
        }

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
      requestChanges: reqChanges,
    });

    return NextResponse.json(pin, { status: 201 });
  }
);
