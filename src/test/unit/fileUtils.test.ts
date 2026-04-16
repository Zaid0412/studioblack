import { describe, it, expect } from "vitest";
import {
  formatFileSize,
  getFileExtension,
  isImage,
  isPdf,
  isSpreadsheet,
  isPreviewable,
  isOpenable,
  fileType,
  displayName,
  fileTypeBadge,
  versionColor,
  statusBadge,
  MAX_UPLOAD_SIZE,
} from "@/lib/fileUtils";

// ── formatFileSize ──────────────────────────────────────────────────────────

describe("formatFileSize", () => {
  it("returns empty string for null", () => {
    expect(formatFileSize(null)).toBe("");
  });

  it("formats bytes", () => {
    expect(formatFileSize(500)).toBe("500 B");
  });

  it("formats kilobytes", () => {
    expect(formatFileSize(1536)).toBe("1.5 KB");
  });

  it("formats megabytes", () => {
    expect(formatFileSize(2.5 * 1024 * 1024)).toBe("2.5 MB");
  });

  it("handles zero", () => {
    expect(formatFileSize(0)).toBe("0 B");
  });

  it("handles boundary at 1024 (KB)", () => {
    expect(formatFileSize(1024)).toBe("1.0 KB");
  });

  it("handles boundary at 1MB", () => {
    expect(formatFileSize(1024 * 1024)).toBe("1.0 MB");
  });
});

// ── getFileExtension ────────────────────────────────────────────────────────

describe("getFileExtension", () => {
  it("extracts extension", () => {
    expect(getFileExtension("photo.png")).toBe("png");
  });

  it("lowercases extension", () => {
    expect(getFileExtension("doc.PDF")).toBe("pdf");
  });

  it("handles multiple dots", () => {
    expect(getFileExtension("file.backup.dwg")).toBe("dwg");
  });

  it("returns empty for no extension", () => {
    expect(getFileExtension("README")).toBe("readme");
  });
});

// ── isImage / isPdf / isSpreadsheet ─────────────────────────────────────────

describe("isImage", () => {
  it.each([
    "photo.png",
    "pic.jpg",
    "pic.jpeg",
    "icon.svg",
    "img.webp",
    "anim.gif",
  ])("returns true for %s", (name) => expect(isImage(name)).toBe(true));

  it.each(["doc.pdf", "sheet.xlsx", "plan.dwg"])(
    "returns false for %s",
    (name) => expect(isImage(name)).toBe(false)
  );
});

describe("isPdf", () => {
  it("returns true for .pdf", () => {
    expect(isPdf("report.pdf")).toBe(true);
  });

  it("returns false for non-pdf", () => {
    expect(isPdf("photo.png")).toBe(false);
  });
});

describe("isSpreadsheet", () => {
  it.each(["data.xls", "data.xlsx", "data.csv"])(
    "returns true for %s",
    (name) => expect(isSpreadsheet(name)).toBe(true)
  );

  it("returns false for non-spreadsheet", () => {
    expect(isSpreadsheet("photo.png")).toBe(false);
  });
});

// ── isPreviewable / isOpenable ──────────────────────────────────────────────

describe("isPreviewable", () => {
  it("returns true for image extensions", () => {
    expect(isPreviewable("png")).toBe(true);
    expect(isPreviewable("jpg")).toBe(true);
  });

  it("returns false for pdf", () => {
    expect(isPreviewable("pdf")).toBe(false);
  });
});

describe("isOpenable", () => {
  it("returns true for images", () => {
    expect(isOpenable("png")).toBe(true);
  });

  it("returns true for pdf", () => {
    expect(isOpenable("pdf")).toBe(true);
  });

  it("returns false for dwg", () => {
    expect(isOpenable("dwg")).toBe(false);
  });
});

// ── fileType ────────────────────────────────────────────────────────────────

describe("fileType", () => {
  it("maps known extensions", () => {
    expect(fileType("plan.pdf")).toBe("PDF");
    expect(fileType("photo.jpg")).toBe("JPEG");
    expect(fileType("data.csv")).toBe("CSV");
    expect(fileType("plan.dwg")).toBe("DWG");
  });

  it("uppercases unknown extensions", () => {
    expect(fileType("model.obj")).toBe("OBJ");
  });

  it("returns FILE for no extension", () => {
    expect(fileType("")).toBe("FILE");
  });
});

// ── displayName ─────────────────────────────────────────────────────────────

describe("displayName", () => {
  it("returns the name as-is", () => {
    expect(displayName("Alice")).toBe("Alice");
  });

  it("extracts prefix from email", () => {
    expect(displayName("alice@example.com")).toBe("alice");
  });

  it("returns fallback for null/undefined", () => {
    expect(displayName(null)).toBe("User");
    expect(displayName(undefined)).toBe("User");
  });

  it("uses custom fallback", () => {
    expect(displayName(null, "Unknown")).toBe("Unknown");
  });

  it("returns fallback for empty string", () => {
    expect(displayName("")).toBe("User");
  });
});

// ── fileTypeBadge ───────────────────────────────────────────────────────────

describe("fileTypeBadge", () => {
  it("returns PDF badge", () => {
    const badge = fileTypeBadge("pdf");
    expect(badge.label).toBe("PDF");
    expect(badge.bg).toBe("#1E3A5F");
  });

  it("returns image badge (green)", () => {
    const badge = fileTypeBadge("png");
    expect(badge.label).toBe("PNG");
    expect(badge.bg).toBe("#1E3F1E");
  });

  it("returns design tool badge (purple)", () => {
    const badge = fileTypeBadge("dwg");
    expect(badge.label).toBe("DWG");
    expect(badge.bg).toBe("#2D1E5F");
  });

  it("returns spreadsheet badge", () => {
    const badge = fileTypeBadge("xlsx");
    expect(badge.label).toBe("XLSX");
    expect(badge.bg).toBe("#1E3F1E");
  });

  it("returns default badge for unknown extension", () => {
    const badge = fileTypeBadge("zip");
    expect(badge.label).toBe("ZIP");
    expect(badge.bg).toBe("var(--bg-elevated)");
  });
});

// ── versionColor ────────────────────────────────────────────────────────────

describe("versionColor", () => {
  it("returns blue for V1", () => {
    expect(versionColor(1).bg).toBe("bg-blue-100");
  });

  it("returns purple for V2", () => {
    expect(versionColor(2).bg).toBe("bg-purple-100");
  });

  it("cycles for V7 (back to blue)", () => {
    expect(versionColor(7).bg).toBe("bg-blue-100");
  });

  it("cycles for V13 (back to blue)", () => {
    expect(versionColor(13).bg).toBe("bg-blue-100");
  });
});

// ── statusBadge ─────────────────────────────────────────────────────────────

describe("statusBadge", () => {
  it("returns approved badge", () => {
    expect(statusBadge("approved").label).toBe("Approved");
  });

  it("returns rejected badge", () => {
    expect(statusBadge("rejected").label).toBe("Changes Requested");
  });

  it("returns reviewed badge", () => {
    expect(statusBadge("reviewed").label).toBe("Reviewed");
  });

  it("returns Draft for pending", () => {
    expect(statusBadge("pending").label).toBe("Draft");
  });

  it("returns Draft for undefined", () => {
    expect(statusBadge(undefined).label).toBe("Draft");
  });
});

// ── MAX_UPLOAD_SIZE ─────────────────────────────────────────────────────────

describe("MAX_UPLOAD_SIZE", () => {
  it("is 50MB", () => {
    expect(MAX_UPLOAD_SIZE).toBe(50 * 1024 * 1024);
  });
});
