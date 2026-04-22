/** Shared validation + sanitisation for attachment uploads. */

/** Extensions accepted by the signed-URL upload route. No leading dots. */
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

/** Strip characters that aren't safe in a Supabase Storage path segment. */
export function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_");
}
