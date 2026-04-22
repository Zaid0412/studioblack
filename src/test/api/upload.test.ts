import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST as signedUrlPOST } from "@/app/api/upload/signed-url/route";
import { POST as avatarPOST } from "@/app/api/avatar/route";
import { mocks } from "../setup";
import {
  mockSession,
  setupAuth,
  parseResponse,
  buildRequest,
  buildFormDataRequest,
  createTestFile,
} from "../helpers";

// ── Tests ───────────────────────────────────────────────────────────────────

describe("POST /api/upload/signed-url", () => {
  beforeEach(() => {
    mocks.supabase.createSignedUploadUrl.mockClear();
    mocks.supabase.getPublicUrl.mockClear();
    mocks.supabase.storageFrom.mockClear();
  });

  it("returns 401 without session", async () => {
    setupAuth(mocks.auth, null);

    const req = buildRequest("/api/upload/signed-url", {
      method: "POST",
      body: { fileName: "doc.pdf", fileSize: 1024 },
    });
    const res = await signedUrlPOST(req);
    const { status } = await parseResponse(res);

    expect(status).toBe(401);
  });

  it("returns 400 for invalid body", async () => {
    setupAuth(mocks.auth, mockSession());

    const req = buildRequest("/api/upload/signed-url", {
      method: "POST",
      body: { fileName: "" },
    });
    const res = await signedUrlPOST(req);
    const { status, body } = await parseResponse(res);

    expect(status).toBe(400);
    expect(body).toMatchObject({ error: "Invalid request body" });
  });

  it("returns 400 for disallowed file type", async () => {
    setupAuth(mocks.auth, mockSession());

    const req = buildRequest("/api/upload/signed-url", {
      method: "POST",
      body: { fileName: "malware.exe", fileSize: 1024 },
    });
    const res = await signedUrlPOST(req);
    const { status, body } = await parseResponse(res);

    expect(status).toBe(400);
    expect(body).toMatchObject({ error: "File type not allowed." });
  });

  it("returns 400 when file size exceeds 50MB", async () => {
    setupAuth(mocks.auth, mockSession());

    const req = buildRequest("/api/upload/signed-url", {
      method: "POST",
      body: { fileName: "huge.pdf", fileSize: 60 * 1024 * 1024 },
    });
    const res = await signedUrlPOST(req);
    const { status, body } = await parseResponse(res);

    expect(status).toBe(400);
    expect(body).toMatchObject({ error: "Invalid request body" });
  });

  it("returns signedUrl + publicUrl on success", async () => {
    setupAuth(mocks.auth, mockSession());

    const req = buildRequest("/api/upload/signed-url", {
      method: "POST",
      body: { fileName: "doc.pdf", fileSize: 1024 },
    });
    const res = await signedUrlPOST(req);
    const { status, body } = await parseResponse<{
      signedUrl: string;
      publicUrl: string;
    }>(res);

    expect(status).toBe(200);
    expect(body.signedUrl).toContain("token=signed-token");
    expect(body.publicUrl).toContain("test.supabase.co");
    expect(mocks.supabase.createSignedUploadUrl).toHaveBeenCalledTimes(1);
  });

  it("returns 500 when Supabase fails to mint a signed URL", async () => {
    setupAuth(mocks.auth, mockSession());
    mocks.supabase.createSignedUploadUrl.mockResolvedValueOnce({
      data: null,
      error: new Error("storage offline"),
    });

    const req = buildRequest("/api/upload/signed-url", {
      method: "POST",
      body: { fileName: "doc.pdf", fileSize: 1024 },
    });
    const res = await signedUrlPOST(req);
    const { status, body } = await parseResponse(res);

    expect(status).toBe(500);
    expect(body).toMatchObject({ error: "Upload URL generation failed." });
  });
});

describe("POST /api/avatar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupAuth(mocks.auth, mockSession());
  });

  it("returns 401 without session", async () => {
    setupAuth(mocks.auth, null);

    const formData = new FormData();
    formData.append("file", createTestFile("avatar.png", "image/png"));

    const req = buildFormDataRequest("/api/avatar", formData);
    const res = await avatarPOST(req);
    const { status } = await parseResponse(res);

    expect(status).toBe(401);
  });

  it("returns 400 when no file provided", async () => {
    const formData = new FormData();
    const req = buildFormDataRequest("/api/avatar", formData);
    const res = await avatarPOST(req);
    const { status, body } = await parseResponse(res);

    expect(status).toBe(400);
    expect(body).toMatchObject({ error: "No file provided" });
  });

  it("rejects invalid file type", async () => {
    const formData = new FormData();
    formData.append("file", createTestFile("test.gif", "image/gif"));

    const req = buildFormDataRequest("/api/avatar", formData);
    const res = await avatarPOST(req);
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

    const req = buildFormDataRequest("/api/avatar", formData);
    const res = await avatarPOST(req);
    const { status, body } = await parseResponse(res);

    expect(status).toBe(400);
    expect(body).toMatchObject({ error: "File too large" });
  });

  it("uploads successfully and returns URL", async () => {
    const formData = new FormData();
    formData.append("file", createTestFile("avatar.png", "image/png"));

    const req = buildFormDataRequest("/api/avatar", formData);
    const res = await avatarPOST(req);
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

    const req = buildFormDataRequest("/api/avatar", formData);
    const res = await avatarPOST(req);
    const { status, body } = await parseResponse(res);

    expect(status).toBe(500);
    expect(body).toMatchObject({ error: "Upload failed" });
  });

  it("removes stale avatar files with other extensions", async () => {
    const formData = new FormData();
    formData.append("file", createTestFile("avatar.webp", "image/webp"));

    const req = buildFormDataRequest("/api/avatar", formData);
    await avatarPOST(req);

    expect(mocks.supabase.remove).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.stringContaining("avatar.jpeg"),
        expect.stringContaining("avatar.png"),
      ])
    );
  });
});
