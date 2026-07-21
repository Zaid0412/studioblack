import { NextResponse } from "next/server";
import { issueRevision } from "@/lib/queries";
import { withAuth } from "@/lib/withAuth";
import { getServerFeatureFlag } from "@/lib/posthog-server";
import { parseRequest, issueRevisionSchema } from "@/lib/validations";

/**
 * POST /api/projects/[id]/attachments/[attachmentId]/issue
 *
 * Issue the drawing that owns this version as its next official revision
 * (Design → Document Control, PR-3). PM-only, and gated on the
 * `designDocumentControl` flag — with the module dormant the endpoint 404s.
 */
export const POST = withAuth(
  {
    allowedRoles: ["pm"],
    projectAccess: true,
    rateLimit: { limit: 10, windowMs: 60_000 },
  },
  async (req, { user, orgId }, params) => {
    const enabled = await getServerFeatureFlag(
      "designDocumentControl",
      user.id,
      false
    );
    if (!enabled) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    if (!orgId) {
      return NextResponse.json({ error: "No organization" }, { status: 400 });
    }

    const parsed = await parseRequest(req, issueRevisionSchema);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    const result = await issueRevision({
      attachmentId: params.attachmentId,
      projectId: params.id,
      orgId,
      userId: user.id,
      issuePurpose: parsed.data.issuePurpose,
    });

    if (result.revision === null) {
      if (result.reason === "no_drawing") {
        return NextResponse.json(
          { error: "This file is not a drawing and cannot be issued" },
          { status: 400 }
        );
      }
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json(result.revision, { status: 201 });
  }
);
