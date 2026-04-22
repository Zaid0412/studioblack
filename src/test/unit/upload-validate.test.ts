import { describe, it, expect } from "vitest";

import { ATTACHMENT_EXTENSIONS, sanitizeFilename } from "@/lib/upload/validate";

describe("sanitizeFilename", () => {
  it("keeps safe characters intact", () => {
    expect(sanitizeFilename("My-File_v2.pdf")).toBe("My-File_v2.pdf");
  });

  it("replaces spaces with underscore", () => {
    expect(sanitizeFilename("my file.pdf")).toBe("my_file.pdf");
  });

  it("replaces path separators and special chars", () => {
    expect(sanitizeFilename("a/b\\c?d:e*.png")).toBe("a_b_c_d_e_.png");
  });

  it("preserves dots, dashes, and underscores", () => {
    expect(sanitizeFilename(".-_test.-_")).toBe(".-_test.-_");
  });
});

describe("ATTACHMENT_EXTENSIONS", () => {
  it("contains common design and document extensions", () => {
    expect(ATTACHMENT_EXTENSIONS.has("pdf")).toBe(true);
    expect(ATTACHMENT_EXTENSIONS.has("dwg")).toBe(true);
    expect(ATTACHMENT_EXTENSIONS.has("png")).toBe(true);
    expect(ATTACHMENT_EXTENSIONS.has("xlsx")).toBe(true);
  });

  it("rejects executable and script extensions", () => {
    expect(ATTACHMENT_EXTENSIONS.has("exe")).toBe(false);
    expect(ATTACHMENT_EXTENSIONS.has("sh")).toBe(false);
    expect(ATTACHMENT_EXTENSIONS.has("bat")).toBe(false);
  });

  it("stores extensions without leading dots", () => {
    expect(ATTACHMENT_EXTENSIONS.has(".pdf")).toBe(false);
  });
});
