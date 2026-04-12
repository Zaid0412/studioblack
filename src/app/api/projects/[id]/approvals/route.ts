import { NextResponse } from "next/server";
import {
  getApprovals,
  createApproval,
  markProjectCompletedIfAllPhasesComplete,
  getProjectName,
  getProjectTeamEmails,
} from "@/lib/queries";
import { sendNotificationEmail, escapeHtml } from "@/lib/email";
import { createNotificationsForTeam } from "@/lib/notifications";
import { withAuth } from "@/lib/withAuth";
import { parseRequest, createApprovalSchema } from "@/lib/validations";
import { logger } from "@/lib/logger";

/** GET /api/projects/[id]/approvals — list approval records. */
export const GET = withAuth(
  { projectAccess: true },
  async (req, ctx, params) => {
    const { id } = params;

    const rows = await getApprovals(id);
    return NextResponse.json(rows);
  }
);

/** POST /api/projects/[id]/approvals — submit an approval decision (client only). */
export const POST = withAuth(
  { allowedRoles: ["client"], projectAccess: true },
  async (req, { user }, params) => {
    const { id } = params;

    const parsed = await parseRequest(req, createApprovalSchema);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }
    const { decision, comment, phaseId } = parsed.data;

    const approval = await createApproval({
      projectId: id,
      phaseId: phaseId || null,
      userId: user.id,
      decision,
      comment: comment || "",
    });

    // Atomically mark project as completed only when all phases are done
    if (decision === "approved") {
      await markProjectCompletedIfAllPhasesComplete(id);
    }

    // Send email notifications to PM and architects on the project
    try {
      const projectName = (await getProjectName(id)) || "a project";
      const clientName = user.name || user.email;

      // Get all org members (PM + architects) associated with this project
      const teamEmails = await getProjectTeamEmails(id);

      const subject =
        decision === "approved"
          ? `Project Approved: ${projectName}`
          : `Changes Requested: ${projectName}`;

      const body =
        decision === "approved"
          ? `<p><strong>${escapeHtml(clientName)}</strong> has approved the project <strong>${escapeHtml(projectName)}</strong>.</p>
         <p style="color: #16a34a; font-weight: 600;">✓ Final Approval Recorded</p>`
          : `<p><strong>${escapeHtml(clientName)}</strong> has requested changes on the project <strong>${escapeHtml(projectName)}</strong>.</p>
         ${comment ? `<p style="color: #666;">Comment: "${escapeHtml(comment)}"</p>` : ""}`;

      for (const recipient of teamEmails) {
        sendNotificationEmail(recipient.email, subject, body).catch((err) =>
          logger.error("Approval notification email failed", {
            projectId: id,
            email: recipient.email,
            error: err,
          })
        );
      }
      // In-app notifications
      const notifTitle =
        decision === "approved"
          ? `Project approved: ${projectName}`
          : `Changes requested: ${projectName}`;
      await createNotificationsForTeam(
        id,
        user.id,
        "approval",
        notifTitle,
        comment || ""
      );
    } catch (err) {
      logger.error("Failed to send approval notifications", {
        projectId: id,
        error: err,
      });
    }

    return NextResponse.json(approval, { status: 201 });
  }
);
