import { NextResponse } from "next/server";
import {
  getProjectForSendToClient,
  getUserByEmail,
  createClientUser,
} from "@/lib/queries";
import { withAuth } from "@/lib/withAuth";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";

/**
 * POST /api/projects/[id]/send-to-client
 *
 * PM-only. Pre-creates a client user if needed, then triggers a magic link
 * email so the client can access their project dashboard.
 */
export const POST = withAuth(
  { allowedRoles: ["pm"], projectAccess: true, rateLimit: { limit: 5, windowMs: 60_000 } },
  async (req, ctx, params) => {
    const { id } = params;

    // Get the project to find client email
    const project = await getProjectForSendToClient(id);

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
    const existingUser = await getUserByEmail(project.client_email);

    // Pre-create client user if they don't exist
    if (!existingUser) {
      const clientName =
        project.client_name || project.client_email.split("@")[0];
      await createClientUser(clientName, project.client_email);
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
