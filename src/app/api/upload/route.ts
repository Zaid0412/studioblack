import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { withAuth } from "@/lib/withAuth";
import { rateLimit } from "@/lib/rateLimit";

/**
 * POST /api/upload — Upload a file to Supabase Storage.
 * Returns the public URL of the uploaded file.
 */
export const POST = withAuth({}, async (req, { user }) => {
  const { allowed } = rateLimit(`upload:${user.id}`, {
    limit: 20,
    windowMs: 60_000,
  });
  if (!allowed) {
    return NextResponse.json(
      { error: "Too many uploads. Please wait a moment." },
      { status: 429 }
    );
  }

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  if (!file) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  // Validate file size (50MB max)
  const MAX_SIZE = 50 * 1024 * 1024;
  if (file.size > MAX_SIZE) {
    return NextResponse.json(
      { error: "File too large. Maximum size is 50MB." },
      { status: 400 }
    );
  }

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");

  // Validate file type (allowlist approach)
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
  const ext = "." + (safeName.split(".").pop()?.toLowerCase() ?? "");
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    return NextResponse.json(
      { error: "File type not allowed." },
      { status: 400 }
    );
  }

  const supabase = getSupabaseAdmin();
  const timestamp = Date.now();
  const path = `${user.id}/${timestamp}-${safeName}`;

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  const { error } = await supabase.storage
    .from("attachments")
    .upload(path, buffer, {
      contentType: file.type,
      upsert: false,
    });

  if (error) {
    console.error("[upload] Supabase error:", error);
    return NextResponse.json(
      { error: "Upload failed. Please try again." },
      { status: 500 }
    );
  }

  const { data: urlData } = supabase.storage
    .from("attachments")
    .getPublicUrl(path);

  return NextResponse.json({
    url: urlData.publicUrl,
    fileName: file.name,
  });
});
