/** Shared file type/extension utilities. */

const IMAGE_EXTENSIONS = ["png", "jpg", "jpeg", "svg", "webp", "gif"];

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

/** Review status → badge colors and label. */
export function statusBadge(status: string | undefined) {
  switch (status) {
    case "approved":
      return { bg: "bg-[#0A2E14]", text: "text-[#22C55E]", label: "Approved" };
    case "rejected":
      return {
        bg: "bg-[#2E1F0A]",
        text: "text-[#F59E0B]",
        label: "Changes Requested",
      };
    case "reviewed":
      return { bg: "bg-[#242424]", text: "text-[#A0A0A0]", label: "Reviewed" };
    case "pending":
    default:
      return { bg: "bg-[#242424]", text: "text-[#666666]", label: "Draft" };
  }
}
