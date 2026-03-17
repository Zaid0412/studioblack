/** Shared file type/extension utilities. */

const IMAGE_EXTENSIONS = ["png", "jpg", "jpeg", "svg", "webp", "gif"];

/**
 *
 */
export function getFileExtension(fileName: string): string {
  return fileName.split(".").pop()?.toLowerCase() || "";
}

/**
 *
 */
export function isImage(fileName: string): boolean {
  return IMAGE_EXTENSIONS.includes(getFileExtension(fileName));
}

/**
 *
 */
export function isPdf(fileName: string): boolean {
  return getFileExtension(fileName) === "pdf";
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
  };
  return map[ext] || ext.toUpperCase() || "FILE";
}

/** Review status → badge colors and label. */
export function statusBadge(status: string | undefined) {
  switch (status) {
    case "approved":
      return { bg: "bg-[#0A2E14]", text: "text-[#22C55E]", label: "Approved" };
    case "rejected":
      return { bg: "bg-[#2E0A0A]", text: "text-[#EF4444]", label: "Rejected" };
    case "reviewed":
      return { bg: "bg-[#242424]", text: "text-[#A0A0A0]", label: "Reviewed" };
    case "pending":
    default:
      return { bg: "bg-[#242424]", text: "text-[#666666]", label: "Draft" };
  }
}
