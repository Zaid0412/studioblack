import { NextResponse } from "next/server";
import {
  verifyTaskAccess,
  getTaskOrgId,
  getStandaloneTaskAttachment,
  getMemberRole,
  deleteAttachmentById,
} from "@/lib/queries";
import { withAuth } from "@/lib/withAuth";

/** DELETE /api/tasks/[id]/attachments/[attachmentId] — delete an attachment. */
export const DELETE = withAuth(
  { blockedRoles: ["client"] },
  async (_req, { user, orgId }, params) => {
    const { id: taskId, attachmentId } = params;

    if (!(await verifyTaskAccess(taskId, orgId))) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    // Get task's org_id for role check
    const taskOrgId = await getTaskOrgId(taskId);

    // Verify attachment exists and belongs to this task
    const attachment = await getStandaloneTaskAttachment(attachmentId, taskId);
    if (!attachment) {
      return NextResponse.json(
        { error: "Attachment not found" },
        { status: 404 }
      );
    }

    // Only uploader or org admin/owner can delete
    if (attachment.uploaded_by !== user.id) {
      const role = taskOrgId
        ? await getMemberRole(taskOrgId, user.id)
        : null;
      if (role !== "owner" && role !== "admin") {
        return NextResponse.json(
          { error: "Only the uploader or org admins can delete attachments" },
          { status: 403 }
        );
      }
    }

    await deleteAttachmentById(attachmentId);
    return NextResponse.json({ success: true });
  }
);
