import { NextResponse } from "next/server";
import { getRevisionsForAttachment } from "@/lib/queries";
import { withAuth } from "@/lib/withAuth";

/**
 * GET /api/projects/[id]/attachments/[attachmentId]/revisions
 *
 * Revision history for the drawing this version belongs to (newest first),
 * for the review workspace (Design → Document Control, PR-3). Read-only, so no
 * flag gate — it's empty for loose files and drawings that were never issued.
 */
export const GET = withAuth(
  { projectAccess: true },
  async (_req, _ctx, params) => {
    const revisions = await getRevisionsForAttachment(
      params.attachmentId,
      params.id
    );
    return NextResponse.json({ revisions });
  }
);
