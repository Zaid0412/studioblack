import { NextResponse } from "next/server";
import { withAuth } from "@/lib/withAuth";
import { revertDocumentToVersion } from "@/lib/queries";
import { parseRequest, revertDocumentSchema } from "@/lib/validations";

/**
 * POST /api/projects/[id]/documents/[documentId]/revert
 *
 * Append-only revert: copies the target version's file fields into a new
 * row at MAX(version)+1. Reuses the target's storage_path — no extra storage
 * cost. The original target version is preserved unchanged in the history.
 * PM / architect only.
 */
export const POST = withAuth(
  {
    projectAccess: true,
    allowedRoles: ["pm", "architect"],
    rateLimit: { limit: 30, windowMs: 60_000 },
  },
  async (req, { user }, params) => {
    const { id, documentId } = params;
    const parsed = await parseRequest(req, revertDocumentSchema);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }
    const row = await revertDocumentToVersion({
      documentId,
      projectId: id,
      targetVersion: parsed.data.targetVersion,
      uploadedBy: user.id,
    });
    if (row === null) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    if (row === "target_not_found") {
      return NextResponse.json(
        { error: `Version ${parsed.data.targetVersion} does not exist.` },
        { status: 404 }
      );
    }
    return NextResponse.json(row, { status: 201 });
  }
);
