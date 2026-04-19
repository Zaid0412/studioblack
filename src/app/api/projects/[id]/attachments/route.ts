import { NextResponse } from "next/server";
import {
  getAttachments,
  verifyResourceOwnership,
  uploadNewVersion,
  getProjectName,
  createProjectAttachment,
} from "@/lib/queries";
import { createNotificationsForTeam } from "@/lib/notifications";
import { withAuth } from "@/lib/withAuth";
import { env } from "@/env";
import { parseRequest, createProjectAttachmentSchema } from "@/lib/validations";
import { logger } from "@/lib/logger";

/** GET /api/projects/[id]/attachments — list attachments. */
export const GET = withAuth(
  { projectAccess: true },
  async (req, { effectiveRole }, params) => {
    const { id } = params;

    const { searchParams } = req.nextUrl;
    const attachments = await getAttachments({
      projectId: id,
      phaseId: searchParams.get("phaseId") || undefined,
      taskId: searchParams.get("taskId") || undefined,
      all: searchParams.get("all") === "true",
      clientOnly: effectiveRole === "client",
    });

    return NextResponse.json(attachments);
  }
);

/** POST /api/projects/[id]/attachments — add an attachment record. */
export const POST = withAuth(
  { projectAccess: true, rateLimit: { limit: 20, windowMs: 60_000 } },
  async (req, { user }, params) => {
    const { id } = params;

    const parsed = await parseRequest(req, createProjectAttachmentSchema);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }
    const { fileUrl, fileName, description, phaseId, taskId, versionGroup } =
      parsed.data;

    // Business logic: fileUrl must point to Supabase storage
    let fileHostname: string;
    try {
      fileHostname = new URL(fileUrl).hostname;
    } catch {
      return NextResponse.json(
        { error: "fileUrl is not a valid URL" },
        { status: 400 }
      );
    }
    const supabaseHostname = new URL(env().NEXT_PUBLIC_SUPABASE_URL).hostname;
    if (fileHostname !== supabaseHostname) {
      return NextResponse.json(
        { error: "fileUrl must point to the Supabase storage domain" },
        { status: 400 }
      );
    }

    const ownershipError = await verifyResourceOwnership(id, phaseId, taskId);
    if (ownershipError) {
      return NextResponse.json({ error: ownershipError }, { status: 404 });
    }

    // Helper to send upload notifications (team only — client is notified via send-to-client)
    const sendUploadNotifications = async (attachmentFileName: string) => {
      try {
        const projName = await getProjectName(id);
        const uploaderName = user.name || user.email;
        const notifTitle = `New upload: ${attachmentFileName}`;
        const notifDesc = `${uploaderName} uploaded a file to ${projName || "project"}`;
        await createNotificationsForTeam(
          id,
          user.id,
          "upload",
          notifTitle,
          notifDesc
        );
      } catch (err) {
        logger.error("Attachment upload notification failed", {
          projectId: id,
          error: err,
        });
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

    const attachment = await createProjectAttachment({
      projectId: id,
      phaseId: phaseId || null,
      taskId: taskId || null,
      uploadedBy: user.id,
      fileUrl,
      fileName,
      description: description || "",
    });

    await sendUploadNotifications(fileName);

    return NextResponse.json(attachment, { status: 201 });
  }
);
