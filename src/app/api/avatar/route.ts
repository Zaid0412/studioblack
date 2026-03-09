import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_SIZE = 1 * 1024 * 1024; // 1 MB

/** Upload a new avatar image to Supabase Storage and return its public URL. */
export async function POST(request: NextRequest) {
  // 1. Auth check
  const session = await auth.api.getSession({
    headers: request.headers,
  });
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 2. Parse FormData
  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  if (!file) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  // 3. Validate
  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json({ error: "Invalid file type" }, { status: 400 });
  }
  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: "File too large" }, { status: 400 });
  }

  // 4. Upload to Supabase Storage
  const ext = file.type.split("/")[1]; // jpeg, png, webp
  const path = `${session.user.id}/avatar.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  const { error } = await getSupabaseAdmin()
    .storage.from("avatars")
    .upload(path, buffer, {
      contentType: file.type,
      upsert: true,
    });

  if (error) {
    console.error("Avatar upload failed:", error);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }

  // 5. Build public URL with cache buster
  const { data } = getSupabaseAdmin()
    .storage.from("avatars")
    .getPublicUrl(path);
  const url = `${data.publicUrl}?t=${Date.now()}`;

  return NextResponse.json({ url });
}
