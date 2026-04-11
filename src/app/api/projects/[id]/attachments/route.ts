import { NextResponse } from "next/server";
import {
  getAttachments,
  verifyPhaseOwnership,
  verifyTaskOwnership,
  uploadNewVersion,
} from "@/lib/queries";
import { getPool } from "@/lib/db";
import { createNotificationsForTeam } from "@/lib/notifications";
import { withAuth } from "@/lib/withAuth";
import { rateLimit } from "@/lib/rateLimit";
import { env } from "@/env";
import { parseBody, createProjectAttachmentSchema } from "@/lib/validations";

/** GET /api/projects/[id]/attachments — list attachments. */
export const GET = withAuth(
  { projectAccess: true },
  async (req, { user }, params) => {
    const { id } = params;

    const { searchParams } = req.nextUrl;
    const attachments = await getAttachments({
      projectId: id,
      phaseId: searchParams.get("phaseId") || undefined,
      taskId: searchParams.get("taskId") || undefined,
      all: searchParams.get("all") === "true",
      clientOnly: user.role === "client",
    });

    return NextResponse.json(attachments);
  }
);

/** POST /api/projects/[id]/attachments — add an attachment record. */
export const POST = withAuth(
  { projectAccess: true },
  async (req, { user }, params) => {
    const { allowed } = rateLimit(`attach:${user.id}`, {
      limit: 20,
      windowMs: 60_000,
    });
    if (!allowed) {
      return NextResponse.json(
        { error: "Too many requests. Please wait a moment." },
        { status: 429 }
      );
    }

    const { id } = params;

    const raw = await req.json();
    const parsed = parseBody(createProjectAttachmentSchema, raw);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }
    const { fileUrl, fileName, description, phaseId, taskId, versionGroup } =
      parsed.data;

    // Business logic: fileUrl must point to Supabase storage
    const supabaseHostname = new URL(env().NEXT_PUBLIC_SUPABASE_URL).hostname;
    if (new URL(fileUrl).hostname !== supabaseHostname) {
      return NextResponse.json(
        { error: "fileUrl must point to the Supabase storage domain" },
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

    // Helper to send upload notifications (team only — client is notified via send-to-client)
    const sendUploadNotifications = async (attachmentFileName: string) => {
      try {
        const pool = getPool();
        const { rows: project } = await pool.query(
          `SELECT name FROM project WHERE id = $1`,
          [id]
        );
        const proj = project[0];
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
      } catch (err) {
        console.error("[attachment] Failed to send notification:", err);
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
