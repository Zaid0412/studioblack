import { NextResponse } from "next/server";
import { getPool } from "@/lib/db";
import { withAuth } from "@/lib/withAuth";
import { rateLimit } from "@/lib/rateLimit";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";

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
    } = await pool.query(
      `SELECT name, client_email FROM project WHERE id = $1`,
      [id]
    );

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

    // Send magic link via better-auth server API (direct call, no HTTP round-trip)
    try {
      await auth.api.signInMagicLink({
        headers: await headers(),
        body: {
          email: project.client_email,
          callbackURL: "/dashboard",
        },
      });
    } catch (err) {
      console.error("[send-to-client] Magic link error:", err);
      return NextResponse.json(
        { error: "Failed to send magic link email" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, email: project.client_email });
  }
);
