import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "@/app/api/avatar/route";
import { mocks } from "../setup";
import { mockSession, setupAuth, parseResponse } from "../helpers";

// ── Helpers ─────────────────────────────────────────────────────────────────

const BASE_URL = "http://localhost:3000";

function buildFormDataRequest(formData: FormData): NextRequest {
  return new NextRequest(new URL("/api/avatar", BASE_URL), {
    method: "POST",
    headers: { origin: BASE_URL, host: "localhost:3000" },
    body: formData,
  });
}

function createTestFile(
  name: string,
  type: string,
  sizeBytes: number = 100
): File {
  const buffer = new ArrayBuffer(sizeBytes);
  return new File([buffer], name, { type });
}

// ── Tests ───────────────────────────────────────────────────────────────────

describe("POST /api/avatar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupAuth(mocks.auth, mockSession());
  });

  it("rejects invalid file type", async () => {
    const formData = new FormData();
    formData.append("file", createTestFile("test.gif", "image/gif"));

    const res = await POST(buildFormDataRequest(formData));
    const { status, body } = await parseResponse(res);

    expect(status).toBe(400);
    expect(body).toMatchObject({ error: "Invalid file type" });
  });

  it("rejects file exceeding 1MB", async () => {
    const formData = new FormData();
    formData.append(
      "file",
      createTestFile("big.png", "image/png", 2 * 1024 * 1024)
    );

    const res = await POST(buildFormDataRequest(formData));
    const { status, body } = await parseResponse(res);

    expect(status).toBe(400);
    expect(body).toMatchObject({ error: "File too large" });
  });

  it("uploads successfully and returns URL", async () => {
    const formData = new FormData();
    formData.append("file", createTestFile("avatar.png", "image/png"));

    const res = await POST(buildFormDataRequest(formData));
    const { status, body } = await parseResponse(res);

    expect(status).toBe(200);
    expect(body.url).toContain("test.supabase.co");
    expect(mocks.supabase.upload).toHaveBeenCalled();
    expect(mocks.supabase.remove).toHaveBeenCalled();
  });

  it("returns 500 when upload fails", async () => {
    mocks.supabase.upload.mockResolvedValueOnce({
      error: new Error("Storage error"),
    });

    const formData = new FormData();
    formData.append("file", createTestFile("avatar.png", "image/png"));

    const res = await POST(buildFormDataRequest(formData));
    const { status, body } = await parseResponse(res);

    expect(status).toBe(500);
    expect(body).toMatchObject({ error: "Upload failed" });
  });

  it("removes stale avatar files with other extensions", async () => {
    const formData = new FormData();
    formData.append("file", createTestFile("avatar.webp", "image/webp"));

    await POST(buildFormDataRequest(formData));

    // Should remove jpeg and png variants
    expect(mocks.supabase.remove).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.stringContaining("avatar.jpeg"),
        expect.stringContaining("avatar.png"),
      ])
    );
  });
});
