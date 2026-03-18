import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { getSupabaseAdmin } from "@/lib/supabase";

/**
 * POST /api/upload — Upload a file to Supabase Storage.
 * Returns the public URL of the uploaded file.
 */
export async function POST(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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

  // Validate file type
  const BLOCKED_EXTENSIONS = [
    ".exe",
    ".bat",
    ".cmd",
    ".sh",
    ".ps1",
    ".msi",
    ".dll",
    ".com",
    ".scr",
  ];
  const BLOCKED_TYPES = [
    "application/x-executable",
    "application/x-msdownload",
  ];
  const ext = "." + safeName.split(".").pop()?.toLowerCase();
  if (BLOCKED_EXTENSIONS.includes(ext) || BLOCKED_TYPES.includes(file.type)) {
    return NextResponse.json(
      { error: "File type not allowed." },
      { status: 400 }
    );
  }

  const supabase = getSupabaseAdmin();
  const timestamp = Date.now();
  const path = `${session.user.id}/${timestamp}-${safeName}`;

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
      { error: "Upload failed: " + error.message },
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
}
