import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { hasProjectAccess } from "@/lib/queries";
import { getPool } from "@/lib/db";
import { sendNotificationEmail, escapeHtml } from "@/lib/email";
import { createNotificationsForTeam } from "@/lib/notifications";

/** GET /api/projects/[id]/approvals — list approval records. */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const allowed = await hasProjectAccess(
    id,
    session.user.id,
    session.user.email,
    session.user.role
  );
  if (!allowed) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const pool = getPool();
  const { rows } = await pool.query(
    `SELECT a.*, u.name AS user_name
     FROM approval a JOIN "user" u ON u.id = a.user_id
     WHERE a.project_id = $1
     ORDER BY a.created_at DESC`,
    [id]
  );

  return NextResponse.json(rows);
}

/** POST /api/projects/[id]/approvals — submit an approval decision (client only). */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  // Only clients can submit approval decisions
  if (session.user.role !== "client") {
    return NextResponse.json(
      { error: "Only clients can submit approval decisions" },
      { status: 403 }
    );
  }

  const allowed = await hasProjectAccess(
    id,
    session.user.id,
    session.user.email,
    session.user.role
  );
  if (!allowed) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { decision, comment, phaseId } = await req.json();
  if (!decision || !["approved", "changes_requested"].includes(decision)) {
    return NextResponse.json(
      { error: "decision must be 'approved' or 'changes_requested'" },
      { status: 400 }
    );
  }

  const pool = getPool();
  const {
    rows: [approval],
  } = await pool.query(
    `INSERT INTO approval (project_id, phase_id, user_id, decision, comment)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [id, phaseId || null, session.user.id, decision, comment || ""]
  );

  // Only mark project as completed when all phases have been approved
  if (decision === "approved") {
    const {
      rows: [phaseCheck],
    } = await pool.query(
      `SELECT COUNT(*) AS total,
              COUNT(*) FILTER (WHERE pp.status = 'completed') AS done
       FROM project_phase pp WHERE pp.project_id = $1`,
      [id]
    );
    const allPhasesComplete =
      Number(phaseCheck.total) > 0 &&
      Number(phaseCheck.done) === Number(phaseCheck.total);
    if (allPhasesComplete || !phaseId) {
      await pool.query(
        `UPDATE project SET status = 'completed', updated_at = now() WHERE id = $1`,
        [id]
      );
    }
  }

  // Send email notifications to PM and architects on the project
  try {
    const { rows: project } = await pool.query(
      `SELECT name FROM project WHERE id = $1`,
      [id]
    );
    const projectName = project[0]?.name || "a project";
    const clientName = session.user.name || session.user.email;

    // Get all org members (PM + architects) associated with this project
    const { rows: teamEmails } = await pool.query(
      `SELECT DISTINCT u.email, u.name FROM project p
       JOIN member m ON m."organizationId" = p.org_id
       JOIN "user" u ON u.id = m."userId"
       WHERE p.id = $1`,
      [id]
    );

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
      sendNotificationEmail(recipient.email, subject, body).catch(
        console.error
      );
    }
    // In-app notifications
    const notifTitle =
      decision === "approved"
        ? `Project approved: ${projectName}`
        : `Changes requested: ${projectName}`;
    await createNotificationsForTeam(
      id,
      session.user.id,
      "approval",
      notifTitle,
      comment || ""
    );
  } catch (err) {
    console.error("[approval] Failed to send notification emails:", err);
  }

  return NextResponse.json(approval, { status: 201 });
}
