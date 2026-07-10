import { NextResponse } from "next/server";
import { getAttachmentPhaseCounts } from "@/lib/queries";
import { withAuth } from "@/lib/withAuth";

/**
 * GET /api/projects/[id]/attachments/phase-counts — per-phase attachment
 * counts (latest version per group). The lightweight companion to the full
 * `attachments?all=true` list: the project layout's stepper/MetaBar consume
 * only these counts, so non-Designs routes avoid fetching every full row.
 */
export const GET = withAuth(
  { projectAccess: true },
  async (_req, { effectiveRole }, params) => {
    const { id } = params;
    const counts = await getAttachmentPhaseCounts({
      projectId: id,
      clientOnly: effectiveRole === "client",
    });
    return NextResponse.json(counts);
  }
);
