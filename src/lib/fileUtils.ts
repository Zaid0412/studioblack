/** Shared file type/extension utilities. */

import { ATTACHMENT_EXTENSIONS } from "@/lib/upload/validate";

/** Derived from ATTACHMENT_EXTENSIONS so the UI filter can't drift from server policy. */
export const UPLOAD_ACCEPTED_TYPES = Array.from(ATTACHMENT_EXTENSIONS)
  .map((ext) => `.${ext}`)
  .join(",");

/** Format a byte count as a human-readable string (B / KB / MB). */
export function formatFileSize(bytes: number | null): string {
  if (bytes == null) return "";
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}

const IMAGE_EXTENSIONS = ["png", "jpg", "jpeg", "svg", "webp", "gif"];
const IMAGE_EXTS_SET = new Set(IMAGE_EXTENSIONS);
const PDF_EXTS_SET = new Set(["pdf"]);
const SPREADSHEET_EXTENSIONS = ["xls", "xlsx", "csv"];

/** Extracts the lowercase file extension from a filename. */
export function getFileExtension(fileName: string): string {
  return fileName.split(".").pop()?.toLowerCase() || "";
}

/** Returns true if the filename has an image extension. */
export function isImage(fileName: string): boolean {
  return IMAGE_EXTENSIONS.includes(getFileExtension(fileName));
}

/** Returns true if the filename has a .pdf extension. */
export function isPdf(fileName: string): boolean {
  return getFileExtension(fileName) === "pdf";
}

/** Returns true if the filename has a spreadsheet extension (.xls, .xlsx, .csv). */
export function isSpreadsheet(fileName: string): boolean {
  return SPREADSHEET_EXTENSIONS.includes(getFileExtension(fileName));
}

/** Returns true if the extension is previewable inline (image formats). */
export function isPreviewable(ext: string): boolean {
  return IMAGE_EXTS_SET.has(ext);
}

/** Returns true if the extension can be opened in a new tab (images + PDFs). */
export function isOpenable(ext: string): boolean {
  return PDF_EXTS_SET.has(ext) || IMAGE_EXTS_SET.has(ext);
}

/** File extension → display type label. */
export function fileType(name: string): string {
  const ext = name.split(".").pop()?.toLowerCase() || "";
  const map: Record<string, string> = {
    pdf: "PDF",
    dwg: "DWG",
    dxf: "DXF",
    png: "PNG",
    jpg: "JPEG",
    jpeg: "JPEG",
    svg: "SVG",
    psd: "PSD",
    ai: "AI",
    xls: "XLS",
    xlsx: "XLSX",
    csv: "CSV",
  };
  return map[ext] || ext.toUpperCase() || "FILE";
}

/** Extract a short display name from a user name or email. */
export function displayName(
  nameOrEmail: string | undefined | null,
  fallback = "User"
): string {
  if (!nameOrEmail) return fallback;
  // If it looks like an email, use the part before @
  if (nameOrEmail.includes("@")) {
    return nameOrEmail.split("@")[0];
  }
  return nameOrEmail;
}

/** File extension → badge colors (bg + text + label) for inline badges. */
export function fileTypeBadge(ext: string): {
  bg: string;
  text: string;
  label: string;
} {
  switch (ext) {
    case "pdf":
      return { bg: "#1E3A5F", text: "#60A5FA", label: "PDF" };
    case "png":
    case "jpg":
    case "jpeg":
    case "webp":
      return { bg: "#1E3F1E", text: "#4ADE80", label: ext.toUpperCase() };
    case "dwg":
    case "ai":
    case "psd":
    case "sketch":
      return { bg: "#2D1E5F", text: "#A78BFA", label: ext.toUpperCase() };
    case "svg":
      return { bg: "#3F2E1E", text: "#FB923C", label: "SVG" };
    case "doc":
    case "docx":
      return { bg: "#1E3A5F", text: "#60A5FA", label: ext.toUpperCase() };
    case "xls":
    case "xlsx":
    case "csv":
      return { bg: "#1E3F1E", text: "#4ADE80", label: ext.toUpperCase() };
    default:
      return {
        bg: "var(--bg-elevated)",
        text: "var(--text-secondary)",
        label: ext.toUpperCase() || "FILE",
      };
  }
}

/** Maximum upload size in bytes (50 MB). */
export const MAX_UPLOAD_SIZE = 50 * 1024 * 1024;

/** Version number → badge colors (bg + text). Cycles for V7+. */
const VERSION_COLORS = [
  {
    bg: "bg-blue-100",
    text: "text-blue-700",
    border: "border border-blue-200",
  }, // V1 — blue
  {
    bg: "bg-purple-100",
    text: "text-purple-700",
    border: "border border-purple-200",
  }, // V2 — purple
  {
    bg: "bg-teal-100",
    text: "text-teal-700",
    border: "border border-teal-200",
  }, // V3 — teal
  {
    bg: "bg-amber-100",
    text: "text-amber-700",
    border: "border border-amber-200",
  }, // V4 — amber
  {
    bg: "bg-pink-100",
    text: "text-pink-700",
    border: "border border-pink-200",
  }, // V5 — pink
  {
    bg: "bg-green-100",
    text: "text-green-700",
    border: "border border-green-200",
  }, // V6 — green
];

/** Return badge color classes for a given version number (cycles for V7+). */
export function versionColor(version: number): {
  bg: string;
  text: string;
  border: string;
} {
  const idx =
    (((version - 1) % VERSION_COLORS.length) + VERSION_COLORS.length) %
    VERSION_COLORS.length;
  return VERSION_COLORS[idx];
}

/** Review status → badge colors and label. */
export function statusBadge(status: string | undefined) {
  switch (status) {
    case "approved":
      return {
        bg: "bg-green-500/15",
        text: "text-green-600",
        label: "Approved",
      };
    case "rejected":
      return {
        bg: "bg-amber-500/15",
        text: "text-amber-600",
        label: "Changes Requested",
      };
    case "reviewed":
      return {
        bg: "bg-bg-elevated",
        text: "text-text-secondary",
        label: "Reviewed",
      };
    case "pending":
    default:
      return { bg: "bg-bg-elevated", text: "text-text-muted", label: "Draft" };
  }
}
