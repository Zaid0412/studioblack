import { NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseAdmin } from "@/lib/supabase";
import { withAuth } from "@/lib/withAuth";
import { logger } from "@/lib/logger";
import { MAX_UPLOAD_SIZE, getFileExtension } from "@/lib/fileUtils";

// Vercel serverless functions cap request bodies at 4.5 MB, so proxying a
// 50 MB upload through a route handler is not an option. Instead the client
// asks this endpoint for a short-lived signed URL and PUTs the file straight
// to Supabase Storage.

const ALLOWED_EXTENSIONS = new Set([
  "pdf",
  "doc",
  "docx",
  "xls",
  "xlsx",
  "ppt",
  "pptx",
  "png",
  "jpg",
  "jpeg",
  "gif",
  "webp",
  "svg",
  "bmp",
  "tiff",
  "tif",
  "dwg",
  "dxf",
  "skp",
  "3ds",
  "max",
  "obj",
  "fbx",
  "blend",
  "psd",
  "ai",
  "eps",
  "indd",
  "mp4",
  "mov",
  "avi",
  "zip",
  "rar",
  "7z",
  "txt",
  "csv",
  "json",
]);

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
    const { fileName } = parsed.data;

    const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
    if (!ALLOWED_EXTENSIONS.has(getFileExtension(safeName))) {
      return NextResponse.json(
        { error: "File type not allowed." },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();
    const path = `${user.id}/${Date.now()}-${safeName}`;

    const { data, error } = await supabase.storage
      .from("attachments")
      .createSignedUploadUrl(path);

    if (error || !data) {
      logger.error("createSignedUploadUrl failed", { error, userId: user.id });
      return NextResponse.json(
        { error: "Upload URL generation failed." },
        { status: 500 }
      );
    }

    const { data: urlData } = supabase.storage
      .from("attachments")
      .getPublicUrl(path);

    return NextResponse.json({
      signedUrl: data.signedUrl,
      publicUrl: urlData.publicUrl,
    });
  }
);
