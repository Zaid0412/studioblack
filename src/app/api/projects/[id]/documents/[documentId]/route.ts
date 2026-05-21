import { NextResponse } from "next/server";
import { withAuth } from "@/lib/withAuth";
import { deleteDocument } from "@/lib/queries";
import { getSupabaseAdmin } from "@/lib/supabase";
import { BUCKETS } from "@/lib/storage/buckets";
import { logger } from "@/lib/logger";

/** DELETE /api/projects/[id]/documents/[documentId] — remove the doc row + storage object. */
export const DELETE = withAuth(
  {
    projectAccess: true,
    allowedRoles: ["pm", "architect"],
    rateLimit: { limit: 30, windowMs: 60_000 },
  },
  async (_req, _ctx, params) => {
    const { id, documentId } = params;
    const storagePath = await deleteDocument(documentId, id);
    if (!storagePath) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const supabase = getSupabaseAdmin();
    const { error } = await supabase.storage
      .from(BUCKETS.documents)
      .remove([storagePath]);
    if (error) {
      logger.error("document storage cleanup failed", {
        documentId,
        error: error.message,
      });
    }
    return NextResponse.json({ ok: true });
  }
);
