import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { getAttachments, hasProjectAccess } from "@/lib/queries";
import { getPool } from "@/lib/db";
import { sendNotificationEmail } from "@/lib/email";
import { createNotificationsForTeam, createNotificationForClient } from "@/lib/notifications";

/** GET /api/projects/[id]/attachments — list attachments. */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const allowed = await hasProjectAccess(id, session.user.id, session.user.email, session.user.role);
  if (!allowed) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = req.nextUrl;
  const attachments = await getAttachments({
    projectId: id,
    phaseId: searchParams.get("phaseId") || undefined,
    taskId: searchParams.get("taskId") || undefined,
    all: searchParams.get("all") === "true",
  });

  return NextResponse.json(attachments);
}

/** POST /api/projects/[id]/attachments — add an attachment record. */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const allowed = await hasProjectAccess(id, session.user.id, session.user.email, session.user.role);
  if (!allowed) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { fileUrl, fileName, description, phaseId, taskId } = await req.json();
  if (!fileUrl || !fileName) {
    return NextResponse.json(
      { error: "fileUrl and fileName are required" },
      { status: 400 }
    );
  }

  const pool = getPool();
  const { rows: [attachment] } = await pool.query(
    `INSERT INTO attachment (project_id, phase_id, task_id, uploaded_by, file_url, file_name, description)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [id, phaseId || null, taskId || null, session.user.id, fileUrl, fileName, description || ""]
  );

  // Notify the client when a team member uploads an attachment
  try {
    const { rows: project } = await pool.query(
      `SELECT name, client_email FROM project WHERE id = $1`,
      [id]
    );
    const proj = project[0];
    if (proj?.client_email) {
      const uploaderName = session.user.name || session.user.email;
      const subject = `New Design Uploaded: ${proj.name}`;
      const body = `<p><strong>${uploaderName}</strong> has uploaded a new file to your project <strong>${proj.name}</strong>.</p>
        <p style="color: #666;">File: ${fileName}</p>
        ${description ? `<p style="color: #666;">Description: ${description}</p>` : ""}
        <p style="margin-top: 16px;"><a href="${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/client-dashboard/projects/${id}" style="color: #2563eb;">View Project →</a></p>`;
      sendNotificationEmail(proj.client_email, subject, body);
    }
    // In-app notifications
    const uploaderName = session.user.name || session.user.email;
    const notifTitle = `New upload: ${fileName}`;
    const notifDesc = `${uploaderName} uploaded a file to ${proj?.name || "project"}`;
    await createNotificationsForTeam(id, session.user.id, "upload", notifTitle, notifDesc);
    await createNotificationForClient(id, "upload", notifTitle, notifDesc);
  } catch (err) {
    console.error("[attachment] Failed to send notification email:", err);
  }

  return NextResponse.json(attachment, { status: 201 });
}
