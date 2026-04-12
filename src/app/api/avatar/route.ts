import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { withAuth } from "@/lib/withAuth";
import { logger } from "@/lib/logger";

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_SIZE = 1 * 1024 * 1024; // 1 MB

/** Upload a new avatar image to Supabase Storage and return its public URL. */
export const POST = withAuth({}, async (req, { user }) => {
  // Parse FormData
  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  if (!file) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  // Validate
  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json({ error: "Invalid file type" }, { status: 400 });
  }
  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: "File too large" }, { status: 400 });
  }

  // Upload to Supabase Storage
  const ext = file.type.split("/")[1]; // jpeg, png, webp
  const path = `${user.id}/avatar.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  const { error } = await getSupabaseAdmin()
    .storage.from("avatars")
    .upload(path, buffer, {
      contentType: file.type,
      upsert: true,
    });

  if (error) {
    logger.error("Avatar upload failed", { error, userId: user.id });
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }

  // Remove old avatars with different extensions
  const allExts = ["jpeg", "png", "webp"];
  const staleFiles = allExts
    .filter((e) => e !== ext)
    .map((e) => `${user.id}/avatar.${e}`);
  await getSupabaseAdmin().storage.from("avatars").remove(staleFiles);

  // Build public URL with cache buster
  const { data } = getSupabaseAdmin()
    .storage.from("avatars")
    .getPublicUrl(path);
  const url = `${data.publicUrl}?t=${Date.now()}`;

  return NextResponse.json({ url });
});
