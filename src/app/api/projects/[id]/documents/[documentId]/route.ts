import { NextResponse } from "next/server";
import { withAuth } from "@/lib/withAuth";
import {
  deleteDocument,
  getDocumentSectionById,
  updateDocument,
} from "@/lib/queries";
import { getSupabaseAdmin } from "@/lib/supabase";
import { BUCKETS } from "@/lib/storage/buckets";
import { logger } from "@/lib/logger";
import { parseRequest, updateDocumentSchema } from "@/lib/validations";

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

/**
 * PATCH /api/projects/[id]/documents/[documentId] — rename, edit description,
 * or move the document to a different section. PM / architect only.
 */
export const PATCH = withAuth(
  {
    projectAccess: true,
    allowedRoles: ["pm", "architect"],
    rateLimit: { limit: 30, windowMs: 60_000 },
  },
  async (req, _ctx, params) => {
    const { id, documentId } = params;
    const parsed = await parseRequest(req, updateDocumentSchema);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }
    // Bound the target section to this project before the UPDATE — without
    // it, a malicious caller could move docs into another project's section.
    // The doc's own existence + project ownership is enforced by the UPDATE's
    // WHERE clause (returns null on miss), so a separate getDocumentById
    // round-trip is redundant.
    if (parsed.data.sectionId) {
      const section = await getDocumentSectionById(parsed.data.sectionId, id);
      if (!section) {
        return NextResponse.json(
          { error: "Target section not found" },
          { status: 400 }
        );
      }
    }
    const updated = await updateDocument({
      documentId,
      projectId: id,
      fileName: parsed.data.fileName,
      description: parsed.data.description,
      sectionId: parsed.data.sectionId,
    });
    if (!updated) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json(updated);
  }
);
