import { NextResponse } from "next/server";
import { withAuth } from "@/lib/withAuth";
import { getDocumentById } from "@/lib/queries";
import { documentUploadUrlSchema, parseRequest } from "@/lib/validations";
import { getFileExtension } from "@/lib/fileUtils";
import { getSupabaseAdmin } from "@/lib/supabase";
import { BUCKETS } from "@/lib/storage/buckets";
import { ATTACHMENT_EXTENSIONS, sanitizeFilename } from "@/lib/upload/validate";
import { logger } from "@/lib/logger";

/**
 * POST /api/projects/[id]/documents/[documentId]/versions/upload-url
 *
 * Mints a signed PUT URL for a new version's bytes. Validates that the
 * caller-supplied document exists in this project before allocating a
 * storage path. Section is inherited from the current row at version
 * creation time, so it's not part of this body.
 */
export const POST = withAuth(
  {
    projectAccess: true,
    allowedRoles: ["pm", "architect"],
    rateLimit: { limit: 20, windowMs: 60_000 },
  },
  async (req, _ctx, params) => {
    const { id, documentId } = params;
    const doc = await getDocumentById(documentId, id);
    if (!doc) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const parsed = await parseRequest(req, documentUploadUrlSchema);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }
    const safeName = sanitizeFilename(parsed.data.fileName);
    if (!ATTACHMENT_EXTENSIONS.has(getFileExtension(safeName))) {
      return NextResponse.json(
        { error: "File type not allowed." },
        { status: 400 }
      );
    }
    const supabase = getSupabaseAdmin();
    const storagePath = `projects/${id}/documents/${crypto.randomUUID()}-${safeName}`;
    const { data, error } = await supabase.storage
      .from(BUCKETS.documents)
      .createSignedUploadUrl(storagePath);
    if (error || !data) {
      logger.error("document version createSignedUploadUrl failed", {
        projectId: id,
        documentId,
        error,
      });
      return NextResponse.json(
        { error: "Upload URL generation failed." },
        { status: 500 }
      );
    }
    return NextResponse.json({ signedUrl: data.signedUrl, storagePath });
  }
);
