import { NextResponse } from "next/server";
import {
  getPinComments,
  createPinComment,
  createPinWithTask,
  getAttachmentById,
  getPinCommentById,
} from "@/lib/queries";
import { withAuth } from "@/lib/withAuth";
import { escapeHtml } from "@/lib/email";
import { env } from "@/env";
import { logger } from "@/lib/logger";
import {
  createNotification,
  createNotificationsForTeam,
  notifyUserByEmailWithContext,
  notifyTeamByEmail,
} from "@/lib/notifications";
import { parseRequest, createPinSchema } from "@/lib/validations";
import { centroidOf } from "@/lib/shapeUtils";
import type { PinShapeData, PinShapeType } from "@/types";

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
  { projectAccess: true, rateLimit: { limit: 30, windowMs: 60_000 } },
  async (req, { user }, params) => {
    const { id, attachmentId } = params;

    // Verify attachment belongs to this project
    const attachment = await getAttachmentById(attachmentId, id);
    if (!attachment) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const parsed = await parseRequest(req, createPinSchema);
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
      shape,
      shape_color,
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

    // Shapes own their own anchor (centroid). For plain pins, x/y/page are
    // all-or-nothing.
    let xVal: number | null;
    let yVal: number | null;
    let pageVal: number | null;
    let shapeType: PinShapeType | null = null;
    let shapeData: PinShapeData | null = null;

    if (shape) {
      if (page === undefined || page === null) {
        return NextResponse.json(
          { error: "page is required when posting a shape annotation" },
          { status: 400 }
        );
      }
      const [cx, cy] = centroidOf(shape);
      xVal = cx;
      yVal = cy;
      pageVal = page;
      shapeType = shape.type;
      shapeData =
        shape.type === "rectangle"
          ? { x: shape.x, y: shape.y, w: shape.w, h: shape.h }
          : shape.type === "circle"
            ? { cx: shape.cx, cy: shape.cy, rx: shape.rx, ry: shape.ry }
            : { points: shape.points };
    } else {
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

      xVal = hasAllCoords ? x_percent : null;
      yVal = hasAllCoords ? y_percent : null;
      pageVal = hasAllCoords ? page : null;
    }
    const reqChanges = request_changes === true;
    const shapeColorVal = shape ? (shape_color ?? null) : null;

    // Create pin + task in a single transaction if needed
    const needsTask = assign_as_task || (reqChanges && !assign_as_task);
    if (needsTask) {
      const assignedTo = assign_as_task
        ? assign_as_task.assigned_to
        : attachment.uploaded_by;
      const dueDate = assign_as_task?.due_date || null;

      let result: { pinId: string; taskId: string };
      try {
        result = await createPinWithTask({
          attachmentId,
          projectId: id,
          userId: user.id,
          xPercent: xVal,
          yPercent: yVal,
          page: pageVal,
          content: content.trim(),
          requestChanges: reqChanges,
          assignedTo,
          dueDate,
          shapeType,
          shapeData,
          shapeColor: shapeColorVal,
        });
      } catch (err) {
        if (err instanceof Error && err.message === "Project not found") {
          return NextResponse.json(
            { error: "Project not found" },
            { status: 404 }
          );
        }
        throw err;
      }

      const taskTitle =
        content.trim().length > 100
          ? content.trim().slice(0, 97) + "..."
          : content.trim();

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
          taskId: result.taskId,
        }).catch((err) =>
          logger.error("Pin task notification failed", {
            projectId: id,
            error: err,
          })
        );

        // Email the assignee
        notifyUserByEmailWithContext(assignedTo, id, (ctx) => {
          const projectUrl = escapeHtml(
            `${env().NEXT_PUBLIC_APP_URL}/projects/${encodeURIComponent(id)}`
          );
          const subject = reqChanges
            ? `${ctx.projectName} | Changes Requested`
            : `${ctx.projectName} | New Task Assigned`;
          const html = reqChanges
            ? `<p><strong>${escapeHtml(user.name || user.email)}</strong> requested changes on your design in <strong>${escapeHtml(ctx.projectName || "")}</strong>.</p>
               <p style="color: #666;">${escapeHtml(taskTitle)}</p>
               <p style="margin-top: 16px;"><a href="${projectUrl}" style="color: #2563eb;">View Project →</a></p>`
            : `<p><strong>${escapeHtml(user.name || user.email)}</strong> assigned you a task in <strong>${escapeHtml(ctx.projectName || "")}</strong>.</p>
               <p style="color: #666;">${escapeHtml(taskTitle)}</p>
               <p style="margin-top: 16px;"><a href="${projectUrl}" style="color: #2563eb;">View Project →</a></p>`;
          return { subject, html };
        });
      }

      // Notify the rest of the team when changes are requested (fire-and-forget)
      if (reqChanges) {
        createNotificationsForTeam(
          id,
          user.id,
          "review_changes_requested",
          `${user.name || "Client"} requested changes on "${attachment.file_name}"`,
          taskTitle
        ).catch((err) =>
          logger.error("Pin team notification failed", {
            projectId: id,
            error: err,
          })
        );

        const safeReviewer = escapeHtml(user.name || user.email);
        const safeFileName = escapeHtml(attachment.file_name);
        const safeComment = `<p style="color:#555;margin-top:12px;">"${escapeHtml(taskTitle)}"</p>`;

        notifyTeamByEmail(id, [user.id, assignedTo], ({ projectName }) => ({
          subject: `${projectName} | Changes Requested: ${attachment.file_name}`,
          html: `<p><strong>${safeReviewer}</strong> requested changes on <strong>${safeFileName}</strong>.</p>${safeComment}<p style="margin-top:16px;"><a href="${escapeHtml(`${env().NEXT_PUBLIC_APP_URL}/projects/${encodeURIComponent(id)}`)}" style="color: #2563eb;">View Project →</a></p>`,
        }));
      }

      const pin = await getPinCommentById(result.pinId);
      return NextResponse.json(pin, { status: 201 });
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
      shapeType,
      shapeData,
      shapeColor: shapeColorVal,
    });

    return NextResponse.json(pin, { status: 201 });
  }
);
