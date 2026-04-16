import { describe, it, expect } from "vitest";
import { cn, getSafeReturnTo, deriveInitials } from "@/lib/utils";
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
  statusBadge,
  versionColor,
} from "@/lib/fileUtils";
import { initials, capitalize, isOverdue, NEXT_STATUS } from "@/lib/taskUtils";
import { avatarColor } from "@/lib/avatarUtils";

// ── cn ──────────────────────────────────────────────────────────────────────

describe("cn", () => {
  it("merges multiple class strings", () => {
    expect(cn("px-2", "py-4")).toBe("px-2 py-4");
  });

  it("resolves conflicting Tailwind utilities (last wins)", () => {
    expect(cn("px-2", "px-4")).toBe("px-4");
  });

  it("filters out falsy values via clsx", () => {
    expect(cn("px-2", false && "hidden", null, undefined, "py-4")).toBe(
      "px-2 py-4"
    );
  });

  it("handles array inputs", () => {
    expect(cn(["px-2", "py-4"])).toBe("px-2 py-4");
  });

  it("returns empty string for no inputs", () => {
    expect(cn()).toBe("");
  });
});

// ── getSafeReturnTo ──────────────────────────────────────────────────────────

describe("getSafeReturnTo", () => {
  it("returns relative path as-is", () => {
    expect(getSafeReturnTo("/dashboard")).toBe("/dashboard");
  });

  it("returns fallback for null", () => {
    expect(getSafeReturnTo(null)).toBe("/dashboard");
  });

  it("returns fallback for empty string", () => {
    expect(getSafeReturnTo("")).toBe("/dashboard");
  });

  it("rejects absolute URLs", () => {
    expect(getSafeReturnTo("https://evil.com")).toBe("/dashboard");
  });

  it("rejects protocol-relative URLs", () => {
    expect(getSafeReturnTo("//evil.com")).toBe("/dashboard");
  });

  it("uses custom fallback", () => {
    expect(getSafeReturnTo(null, "/home")).toBe("/home");
  });

  it("preserves query strings in relative paths", () => {
    expect(getSafeReturnTo("/projects?tab=files")).toBe("/projects?tab=files");
  });
});

// ── deriveInitials ───────────────────────────────────────────────────────────

describe("deriveInitials", () => {
  it("extracts two initials from full name", () => {
    expect(deriveInitials("John Doe")).toBe("JD");
  });

  it("extracts single initial from one word", () => {
    expect(deriveInitials("John")).toBe("J");
  });

  it("limits to 2 characters", () => {
    expect(deriveInitials("John Michael Doe")).toBe("JM");
  });

  it("uppercases initials", () => {
    expect(deriveInitials("john doe")).toBe("JD");
  });

  it("returns ? for empty string", () => {
    expect(deriveInitials("")).toBe("?");
  });
});

// ── formatFileSize ───────────────────────────────────────────────────────────

describe("formatFileSize", () => {
  it("returns empty string for null", () => {
    expect(formatFileSize(null)).toBe("");
  });

  it("formats bytes", () => {
    expect(formatFileSize(500)).toBe("500 B");
  });

  it("formats kilobytes", () => {
    expect(formatFileSize(2048)).toBe("2.0 KB");
  });

  it("formats megabytes", () => {
    expect(formatFileSize(5 * 1024 * 1024)).toBe("5.0 MB");
  });

  it("formats 0 bytes", () => {
    expect(formatFileSize(0)).toBe("0 B");
  });
});

// ── getFileExtension ─────────────────────────────────────────────────────────

describe("getFileExtension", () => {
  it("extracts extension", () => {
    expect(getFileExtension("photo.png")).toBe("png");
  });

  it("lowercases extension", () => {
    expect(getFileExtension("PLAN.PDF")).toBe("pdf");
  });

  it("handles multiple dots", () => {
    expect(getFileExtension("my.file.dwg")).toBe("dwg");
  });

  it("returns filename lowercased when no dot present", () => {
    expect(getFileExtension("Makefile")).toBe("makefile");
  });
});

// ── File type checks ─────────────────────────────────────────────────────────

describe("file type checks", () => {
  it("isImage detects image files", () => {
    expect(isImage("photo.png")).toBe(true);
    expect(isImage("photo.jpg")).toBe(true);
    expect(isImage("photo.svg")).toBe(true);
    expect(isImage("doc.pdf")).toBe(false);
  });

  it("isPdf detects PDF files", () => {
    expect(isPdf("doc.pdf")).toBe(true);
    expect(isPdf("doc.PDF")).toBe(true);
    expect(isPdf("photo.png")).toBe(false);
  });

  it("isSpreadsheet detects spreadsheet files", () => {
    expect(isSpreadsheet("data.xlsx")).toBe(true);
    expect(isSpreadsheet("data.csv")).toBe(true);
    expect(isSpreadsheet("data.xls")).toBe(true);
    expect(isSpreadsheet("doc.pdf")).toBe(false);
  });

  it("isPreviewable checks image extensions", () => {
    expect(isPreviewable("png")).toBe(true);
    expect(isPreviewable("pdf")).toBe(false);
  });

  it("isOpenable checks images and PDFs", () => {
    expect(isOpenable("png")).toBe(true);
    expect(isOpenable("pdf")).toBe(true);
    expect(isOpenable("dwg")).toBe(false);
  });
});

// ── fileType ─────────────────────────────────────────────────────────────────

describe("fileType", () => {
  it("maps known extensions", () => {
    expect(fileType("plan.pdf")).toBe("PDF");
    expect(fileType("model.dwg")).toBe("DWG");
    expect(fileType("photo.jpg")).toBe("JPEG");
  });

  it("uppercases unknown extensions", () => {
    expect(fileType("archive.zip")).toBe("ZIP");
  });

  it("returns FILE for no extension", () => {
    expect(fileType("")).toBe("FILE");
  });
});

// ── displayName ──────────────────────────────────────────────────────────────

describe("displayName", () => {
  it("returns name as-is", () => {
    expect(displayName("John Doe")).toBe("John Doe");
  });

  it("extracts name from email", () => {
    expect(displayName("john@example.com")).toBe("john");
  });

  it("returns fallback for null", () => {
    expect(displayName(null)).toBe("User");
  });

  it("returns fallback for undefined", () => {
    expect(displayName(undefined)).toBe("User");
  });

  it("uses custom fallback", () => {
    expect(displayName(null, "Unknown")).toBe("Unknown");
  });
});

// ── fileTypeBadge ────────────────────────────────────────────────────────────

describe("fileTypeBadge", () => {
  it("returns PDF badge", () => {
    expect(fileTypeBadge("pdf").label).toBe("PDF");
  });

  it("returns image badge", () => {
    const badge = fileTypeBadge("png");
    expect(badge.label).toBe("PNG");
  });

  it("returns CAD badge", () => {
    expect(fileTypeBadge("dwg").label).toBe("DWG");
  });

  it("returns default for unknown extension", () => {
    const badge = fileTypeBadge("xyz");
    expect(badge.label).toBe("XYZ");
  });
});

// ── statusBadge ──────────────────────────────────────────────────────────────

describe("statusBadge", () => {
  it("returns approved badge", () => {
    expect(statusBadge("approved").label).toBe("Approved");
  });

  it("returns rejected badge as Changes Requested", () => {
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

// ── versionColor ─────────────────────────────────────────────────────────────

describe("versionColor", () => {
  it("returns blue for V1", () => {
    expect(versionColor(1).bg).toContain("blue");
  });

  it("returns purple for V2", () => {
    expect(versionColor(2).bg).toContain("purple");
  });

  it("cycles back for V7 (same as V1)", () => {
    expect(versionColor(7)).toEqual(versionColor(1));
  });
});

// ── initials (taskUtils) ─────────────────────────────────────────────────────

describe("initials", () => {
  it("extracts two initials", () => {
    expect(initials("Jane Smith")).toBe("JS");
  });

  it("limits to 2 characters", () => {
    expect(initials("A B C D")).toBe("AB");
  });
});

// ── capitalize ───────────────────────────────────────────────────────────────

describe("capitalize", () => {
  it("capitalizes first letter", () => {
    expect(capitalize("hello")).toBe("Hello");
  });

  it("handles already capitalized", () => {
    expect(capitalize("Hello")).toBe("Hello");
  });

  it("handles single character", () => {
    expect(capitalize("a")).toBe("A");
  });

  it("handles empty string", () => {
    expect(capitalize("")).toBe("");
  });
});

// ── isOverdue ────────────────────────────────────────────────────────────────

describe("isOverdue", () => {
  it("returns false for null due date", () => {
    expect(isOverdue(null)).toBe(false);
  });

  it("returns false for completed tasks", () => {
    expect(isOverdue("2020-01-01", "completed")).toBe(false);
  });

  it("returns true for past due date", () => {
    expect(isOverdue("2020-01-01")).toBe(true);
  });

  it("returns false for future due date", () => {
    expect(isOverdue("2099-12-31")).toBe(false);
  });

  it("returns true for past date with non-completed status", () => {
    expect(isOverdue("2020-01-01", "in_progress")).toBe(true);
  });
});

// ── NEXT_STATUS ─────────────────────────────────────────────────────────────

describe("NEXT_STATUS", () => {
  it("todo → in_progress", () => {
    expect(NEXT_STATUS["todo"]).toBe("in_progress");
  });

  it("in_progress → completed", () => {
    expect(NEXT_STATUS["in_progress"]).toBe("completed");
  });

  it("completed → todo (cycles back)", () => {
    expect(NEXT_STATUS["completed"]).toBe("todo");
  });
});

// ── avatarColor ──────────────────────────────────────────────────────────────

describe("avatarColor", () => {
  it("returns a hex color string", () => {
    expect(avatarColor("test")).toMatch(/^#[0-9A-F]{6}$/i);
  });

  it("is deterministic (same input → same output)", () => {
    expect(avatarColor("user@test.com")).toBe(avatarColor("user@test.com"));
  });

  it("different inputs can produce different colors", () => {
    const colors = new Set([
      avatarColor("alice"),
      avatarColor("bob"),
      avatarColor("charlie"),
      avatarColor("dave"),
      avatarColor("eve"),
      avatarColor("frank"),
    ]);
    expect(colors.size).toBeGreaterThan(1);
  });
});
