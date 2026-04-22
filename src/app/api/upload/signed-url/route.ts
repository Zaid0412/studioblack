import { NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseAdmin } from "@/lib/supabase";
import { withAuth } from "@/lib/withAuth";
import { logger } from "@/lib/logger";

// Vercel serverless functions cap request bodies at 4.5 MB, so proxying a
// 50 MB upload through a route handler is not an option. Instead the client
// asks this endpoint for a short-lived signed URL and PUTs the file straight
// to Supabase Storage.
const MAX_SIZE = 50 * 1024 * 1024;

const ALLOWED_EXTENSIONS = [
  ".pdf",
  ".doc",
  ".docx",
  ".xls",
  ".xlsx",
  ".ppt",
  ".pptx",
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".webp",
  ".svg",
  ".bmp",
  ".tiff",
  ".tif",
  ".dwg",
  ".dxf",
  ".skp",
  ".3ds",
  ".max",
  ".obj",
  ".fbx",
  ".blend",
  ".psd",
  ".ai",
  ".eps",
  ".indd",
  ".mp4",
  ".mov",
  ".avi",
  ".zip",
  ".rar",
  ".7z",
  ".txt",
  ".csv",
  ".json",
];

const BodySchema = z.object({
  fileName: z.string().min(1).max(255),
  fileSize: z.number().int().positive().max(MAX_SIZE),
});

/**
 * POST /api/upload/signed-url — Issue a short-lived signed URL the browser
 * can PUT the file to directly. Response is tiny JSON, well within Vercel's
 * function body limit regardless of the eventual file size.
 */
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
    const { fileName, fileSize } = parsed.data;

    const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
    const ext = "." + (safeName.split(".").pop()?.toLowerCase() ?? "");
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
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
      fileName,
      fileSize,
    });
  }
);
