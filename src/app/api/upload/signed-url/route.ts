import { NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseAdmin } from "@/lib/supabase";
import { withAuth } from "@/lib/withAuth";
import { logger } from "@/lib/logger";
import { MAX_UPLOAD_SIZE, getFileExtension } from "@/lib/fileUtils";
import { BUCKETS } from "@/lib/storage/buckets";
import { ATTACHMENT_EXTENSIONS, sanitizeFilename } from "@/lib/upload/validate";

// Vercel serverless functions cap request bodies at 4.5 MB, so proxying a
// 50 MB upload through a route handler is not an option. Instead the client
// asks this endpoint for a short-lived signed URL and PUTs the file straight
// to Supabase Storage.
//
// The fileSize check below is advisory — Supabase only enforces the cap on
// the subsequent PUT if `file_size_limit` is set on the `attachments` bucket
// row. See scripts/migrate-attachments-bucket.sql; run it once per env.

const BodySchema = z.object({
  fileName: z.string().min(1).max(255),
  fileSize: z.number().int().positive().max(MAX_UPLOAD_SIZE),
});

/** POST /api/upload/signed-url — issue a short-lived Supabase upload URL. */
export const POST = withAuth(
  { rateLimit: { limit: 20, windowMs: 60_000 } },
  async (req, { user }) => {
    const raw = await req.json().catch(() => null);
    const parsed = BodySchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request body" },
        { status: 400 }
      );
    }

    const safeName = sanitizeFilename(parsed.data.fileName);
    if (!ATTACHMENT_EXTENSIONS.has(getFileExtension(safeName))) {
      return NextResponse.json(
        { error: "File type not allowed." },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();
    const path = `${user.id}/${Date.now()}-${safeName}`;

    const { data, error } = await supabase.storage
      .from(BUCKETS.attachments)
      .createSignedUploadUrl(path);

    if (error || !data) {
      logger.error("createSignedUploadUrl failed", { error, userId: user.id });
      return NextResponse.json(
        { error: "Upload URL generation failed." },
        { status: 500 }
      );
    }

    const { data: urlData } = supabase.storage
      .from(BUCKETS.attachments)
      .getPublicUrl(path);

    return NextResponse.json({
      signedUrl: data.signedUrl,
      publicUrl: urlData.publicUrl,
    });
  }
);
