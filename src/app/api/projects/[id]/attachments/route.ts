import { NextResponse } from "next/server";
import {
  getAttachments,
  verifyPhaseOwnership,
  verifyTaskOwnership,
  uploadNewVersion,
} from "@/lib/queries";
import { getPool } from "@/lib/db";
import { sendNotificationEmail, escapeHtml } from "@/lib/email";
import {
  createNotificationsForTeam,
  createNotificationForClient,
} from "@/lib/notifications";
import { withAuth } from "@/lib/withAuth";

/** GET /api/projects/[id]/attachments — list attachments. */
export const GET = withAuth(
  { projectAccess: true },
  async (req, _ctx, params) => {
    const { id } = params;

    const { searchParams } = req.nextUrl;
    const attachments = await getAttachments({
      projectId: id,
      phaseId: searchParams.get("phaseId") || undefined,
      taskId: searchParams.get("taskId") || undefined,
      all: searchParams.get("all") === "true",
    });

    return NextResponse.json(attachments);
  }
);

/** POST /api/projects/[id]/attachments — add an attachment record. */
export const POST = withAuth(
  { projectAccess: true },
  async (req, { user }, params) => {
    const { id } = params;

    const { fileUrl, fileName, description, phaseId, taskId, versionGroup } =
      await req.json();
    if (!fileUrl || !fileName) {
      return NextResponse.json(
        { error: "fileUrl and fileName are required" },
        { status: 400 }
      );
    }

    if (phaseId) {
      const phaseOwned = await verifyPhaseOwnership(phaseId, id);
      if (!phaseOwned) {
        return NextResponse.json(
          { error: "Phase not found in this project" },
          { status: 404 }
        );
      }
    }
    if (taskId) {
      const taskOwned = await verifyTaskOwnership(taskId, id);
      if (!taskOwned) {
        return NextResponse.json(
          { error: "Task not found in this project" },
          { status: 404 }
        );
      }
    }

    // Helper to send upload notifications
    const sendUploadNotifications = async (attachmentFileName: string) => {
      try {
        const pool = getPool();
        const { rows: project } = await pool.query(
          `SELECT name, client_email FROM project WHERE id = $1`,
          [id]
        );
        const proj = project[0];
        if (proj?.client_email) {
          const uploaderName = user.name || user.email;
          const subject = `New Design Uploaded: ${proj.name}`;
          const body = `<p><strong>${escapeHtml(uploaderName)}</strong> has uploaded a new file to your project <strong>${escapeHtml(proj.name)}</strong>.</p>
          <p style="color: #666;">File: ${escapeHtml(attachmentFileName)}</p>
          ${description ? `<p style="color: #666;">Description: ${escapeHtml(description)}</p>` : ""}
          <p style="margin-top: 16px;"><a href="${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/client-dashboard/projects/${id}" style="color: #2563eb;">View Project →</a></p>`;
          sendNotificationEmail(proj.client_email, subject, body);
        }
        // In-app notifications
        const uploaderName = user.name || user.email;
        const notifTitle = `New upload: ${attachmentFileName}`;
        const notifDesc = `${uploaderName} uploaded a file to ${proj?.name || "project"}`;
        await createNotificationsForTeam(
          id,
          user.id,
          "upload",
          notifTitle,
          notifDesc
        );
        await createNotificationForClient(id, "upload", notifTitle, notifDesc);
      } catch (err) {
        console.error("[attachment] Failed to send notification email:", err);
      }
    };

    // Version upload — use uploadNewVersion helper
    if (versionGroup) {
      const attachment = await uploadNewVersion(
        versionGroup,
        fileUrl,
        fileName,
        user.id,
        id,
        phaseId || null
      );
      await sendUploadNotifications(fileName);
      return NextResponse.json(attachment, { status: 201 });
    }

    const pool = getPool();
    const {
      rows: [attachment],
    } = await pool.query(
      `INSERT INTO attachment (project_id, phase_id, task_id, uploaded_by, file_url, file_name, description)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
      [
        id,
        phaseId || null,
        taskId || null,
        user.id,
        fileUrl,
        fileName,
        description || "",
      ]
    );

    await sendUploadNotifications(fileName);

    return NextResponse.json(attachment, { status: 201 });
  }
);
