import { NextResponse } from "next/server";
import { getPool } from "@/lib/db";
import { withAuth } from "@/lib/withAuth";
import { rateLimit } from "@/lib/rateLimit";
import { env } from "@/env";

/**
 * POST /api/projects/[id]/send-to-client
 *
 * PM-only. Pre-creates a client user if needed, then triggers a magic link
 * email so the client can access their project dashboard.
 */
export const POST = withAuth(
  { allowedRoles: ["pm"], projectAccess: true },
  async (req, ctx, params) => {
    const { allowed } = rateLimit(`send-client:${ctx.user.id}`, {
      limit: 5,
      windowMs: 60_000,
    });
    if (!allowed) {
      return NextResponse.json(
        { error: "Too many requests. Please wait a moment." },
        { status: 429 }
      );
    }

    const { id } = params;

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
    const baseUrl = env().BETTER_AUTH_URL || env().NEXT_PUBLIC_APP_URL;
    const callbackURL = `/dashboard`;

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
);
