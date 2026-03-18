import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { hasProjectAccess } from "@/lib/queries";
import { getPool } from "@/lib/db";

/**
 * POST /api/projects/[id]/send-to-client
 *
 * PM-only. Pre-creates a client user if needed, then triggers a magic link
 * email so the client can access their project dashboard.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const role = session.user.role;

  // Only PMs can send project to client
  if (role !== "pm") {
    return NextResponse.json(
      { error: "Only PMs can send projects to clients" },
      { status: 403 }
    );
  }

  const allowed = await hasProjectAccess(
    id,
    session.user.id,
    session.user.email,
    role
  );
  if (!allowed) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const pool = getPool();

  // Get the project to find client email
  const {
    rows: [project],
  } = await pool.query(`SELECT * FROM project WHERE id = $1`, [id]);

  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  if (!project.client_email) {
    return NextResponse.json(
      { error: "No client email set on this project" },
      { status: 400 }
    );
  }

  // Check if client user already exists
  const {
    rows: [existingUser],
  } = await pool.query(`SELECT id FROM "user" WHERE email = $1`, [
    project.client_email,
  ]);

  // Pre-create client user if they don't exist
  if (!existingUser) {
    const clientName =
      project.client_name || project.client_email.split("@")[0];
    await pool.query(
      `INSERT INTO "user" (id, name, email, role, email_verified, created_at, updated_at)
       VALUES (gen_random_uuid(), $1, $2, 'client', false, now(), now())`,
      [clientName, project.client_email]
    );
  }

  // Send magic link via better-auth
  const baseUrl = process.env.BETTER_AUTH_URL || "http://localhost:3000";
  const callbackURL = `/client-dashboard`;

  try {
    // Use the better-auth magic link API to send the email
    const response = await fetch(
      `${baseUrl}/api/auth/magic-link/send-magic-link`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: project.client_email,
          callbackURL,
        }),
      }
    );

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      return NextResponse.json(
        {
          error:
            (err as { message?: string }).message ||
            "Failed to send magic link",
        },
        { status: 500 }
      );
    }
  } catch {
    return NextResponse.json(
      { error: "Failed to send magic link email" },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true, email: project.client_email });
}
