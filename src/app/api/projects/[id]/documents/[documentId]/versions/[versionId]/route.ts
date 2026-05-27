import { NextResponse } from "next/server";
import { withAuth } from "@/lib/withAuth";
import { deleteDocumentVersion } from "@/lib/queries";
import { getSupabaseAdmin } from "@/lib/supabase";
import { BUCKETS } from "@/lib/storage/buckets";
import { logger } from "@/lib/logger";

/**
 * DELETE /api/projects/[id]/documents/[documentId]/versions/[versionId]
 *
 * Remove one row from the version group. Refuses when it's the only version
 * left — clients should call DELETE on the document itself instead.
 */
export const DELETE = withAuth(
  {
    projectAccess: true,
    allowedRoles: ["pm", "architect"],
    rateLimit: { limit: 30, windowMs: 60_000 },
  },
  async (_req, _ctx, params) => {
    const { id, documentId, versionId } = params;
    const result = await deleteDocumentVersion({
      documentId,
      versionId,
      projectId: id,
    });
    if (result === null) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    if (result === "last_version") {
      return NextResponse.json(
        {
          error:
            "Cannot delete the last remaining version. Delete the document instead.",
        },
        { status: 409 }
      );
    }
    if (result.storagePathToRemove) {
      const supabase = getSupabaseAdmin();
      const { error } = await supabase.storage
        .from(BUCKETS.documents)
        .remove([result.storagePathToRemove]);
      if (error) {
        logger.error("document version storage cleanup failed", {
          versionId,
          error: error.message,
        });
      }
    }
    return NextResponse.json({ ok: true });
  }
);
