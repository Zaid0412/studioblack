import { NextResponse } from "next/server";
import { z } from "zod";
import { withAuth } from "@/lib/withAuth";
import { getDocumentSectionById } from "@/lib/queries";
import { parseRequest } from "@/lib/validations";
import { MAX_UPLOAD_SIZE } from "@/lib/fileUtils";
import { getSupabaseAdmin } from "@/lib/supabase";
import { BUCKETS } from "@/lib/storage/buckets";
import { ATTACHMENT_EXTENSIONS, sanitizeFilename } from "@/lib/upload/validate";
import { getFileExtension } from "@/lib/fileUtils";
import { logger } from "@/lib/logger";

const BodySchema = z.object({
  fileName: z.string().trim().min(1).max(255),
  fileSize: z.number().int().positive().max(MAX_UPLOAD_SIZE),
});

/**
 * POST /api/projects/[id]/document-sections/[sectionId]/documents/upload-url
 *
 * Mints a short-lived signed PUT URL into the (private) documents bucket.
 * Client PUTs the file, then registers the row via POST .../documents with
 * the returned `storagePath`.
 */
export const POST = withAuth(
  {
    projectAccess: true,
    allowedRoles: ["pm", "architect"],
    rateLimit: { limit: 20, windowMs: 60_000 },
  },
  async (req, _ctx, params) => {
    const { id, sectionId } = params;
    const section = await getDocumentSectionById(sectionId, id);
    if (!section) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const parsed = await parseRequest(req, BodySchema);
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
      logger.error("document createSignedUploadUrl failed", {
        projectId: id,
        sectionId,
        error,
      });
      return NextResponse.json(
        { error: "Upload URL generation failed." },
        { status: 500 }
      );
    }
    return NextResponse.json({
      signedUrl: data.signedUrl,
      storagePath,
    });
  }
);
