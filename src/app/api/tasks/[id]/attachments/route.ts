import { NextResponse } from "next/server";
import {
  verifyTaskAccess,
  getTaskAttachments,
  getTaskProjectId,
  createTaskAttachment,
} from "@/lib/queries";
import { withAuth } from "@/lib/withAuth";
import { env } from "@/env";
import { parseRequest, createTaskAttachmentSchema } from "@/lib/validations";

/** GET /api/tasks/[id]/attachments — list attachments for a standalone task. */
export const GET = withAuth(
  { blockedRoles: ["client"] },
  async (_req, { orgId }, params) => {
    const taskId = params.id;

    if (!(await verifyTaskAccess(taskId, orgId))) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const rows = await getTaskAttachments(taskId);
    return NextResponse.json(rows);
  }
);

/** POST /api/tasks/[id]/attachments �� create an attachment record after upload. */
export const POST = withAuth(
  { blockedRoles: ["client"] },
  async (req, { user, orgId }, params) => {
    try {
      const taskId = params.id;

      if (!(await verifyTaskAccess(taskId, orgId))) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
      }

      // Get task's project_id for the attachment record
      const projectId = await getTaskProjectId(taskId);

      const parsed = await parseRequest(req, createTaskAttachmentSchema);
      if (!parsed.success) {
        return NextResponse.json({ error: parsed.error }, { status: 400 });
      }
      const { fileUrl, fileName, fileSize } = parsed.data;

      // Validate fileUrl is from our Supabase instance
      if (!fileUrl.startsWith(env().NEXT_PUBLIC_SUPABASE_URL)) {
        return NextResponse.json(
          { error: "Invalid file URL" },
          { status: 400 }
        );
      }

      const attachment = await createTaskAttachment({
        taskId,
        projectId,
        uploadedBy: user.id,
        fileUrl,
        fileName,
        fileSize: fileSize ?? null,
      });

      return NextResponse.json(attachment, { status: 201 });
    } catch (err) {
      console.error("Attachment POST error:", err);
      return NextResponse.json(
        { error: "Failed to create attachment" },
        { status: 500 }
      );
    }
  }
);
