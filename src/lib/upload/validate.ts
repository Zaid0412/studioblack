/** Shared validation + sanitisation for attachment uploads. */

// Extensions accepted by the signed-URL upload route. No leading dots.
//
// This is the SOLE source of truth for the attachment allow-list: the client
// `<input accept=>` filter (src/lib/fileUtils.ts `UPLOAD_ACCEPTED_TYPES`) is
// derived from this Set so the UI filter can never drift from server policy.
//
// A matching server-side cap (file_size_limit) lives on the Supabase bucket
// row — see scripts/migrate-attachments-bucket.sql.
export const ATTACHMENT_EXTENSIONS = new Set<string>([
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
  "sketch",
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

/**
 * Strip characters that aren't safe in a Supabase Storage path segment.
 * Falls back to "file" when the sanitised result is empty or has no
 * alphanumeric characters (pure dots/underscores) — without this an all-emoji
 * upload becomes "_______.pdf" and `".."` survives as-is.
 */
export function sanitizeFilename(name: string): string {
  const cleaned = name.replace(/[^a-zA-Z0-9._-]/g, "_");
  return /[a-zA-Z0-9]/.test(cleaned) ? cleaned : "file";
}
