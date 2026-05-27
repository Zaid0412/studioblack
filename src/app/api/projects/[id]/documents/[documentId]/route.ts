import { NextResponse } from "next/server";
import { withAuth } from "@/lib/withAuth";
import {
  deleteDocument,
  getDocumentById,
  getDocumentSectionById,
  getLatestVersionForDocument,
  updateDocument,
} from "@/lib/queries";
import { getSupabaseAdmin } from "@/lib/supabase";
import { BUCKETS } from "@/lib/storage/buckets";
import { logger } from "@/lib/logger";
import { parseRequest, updateDocumentSchema } from "@/lib/validations";

/**
 * DELETE /api/projects/[id]/documents/[documentId]
 *
 * Removes the entire version group (every historical row for the document)
 * and all distinct storage objects in one shot. Single-version deletes live
 * under `/versions/[versionId]`.
 */
export const DELETE = withAuth(
  {
    projectAccess: true,
    allowedRoles: ["pm", "architect"],
    rateLimit: { limit: 30, windowMs: 60_000 },
  },
  async (_req, _ctx, params) => {
    const { id, documentId } = params;
    const storagePaths = await deleteDocument(documentId, id);
    if (!storagePaths) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    if (storagePaths.length > 0) {
      const supabase = getSupabaseAdmin();
      const { error } = await supabase.storage
        .from(BUCKETS.documents)
        .remove(storagePaths);
      if (error) {
        logger.error("document storage cleanup failed", {
          documentId,
          error: error.message,
        });
      }
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
    // Old versions are immutable — edits always retarget the current row.
    const [existing, latest] = await Promise.all([
      getDocumentById(documentId, id),
      getLatestVersionForDocument(documentId, id),
    ]);
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    if (latest && existing.version !== latest.latestVersion) {
      return NextResponse.json(
        { error: "Only the latest version can be edited." },
        { status: 409 }
      );
    }
    // Bound the target section to this project before the UPDATE — without
    // it, a malicious caller could move docs into another project's section.
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
