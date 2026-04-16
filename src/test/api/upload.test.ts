import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST as uploadPOST } from "@/app/api/upload/route";
import { POST as avatarPOST } from "@/app/api/avatar/route";
import { mocks } from "../setup";
import {
  mockSession,
  setupAuth,
  parseResponse,
  buildFormDataRequest,
  createTestFile,
} from "../helpers";

// ── Tests ───────────────────────────────────────────────────────────────────

describe("POST /api/upload", () => {
  beforeEach(() => {
    mocks.supabase.upload.mockClear();
    mocks.supabase.getPublicUrl.mockClear();
    mocks.supabase.storageFrom.mockClear();
  });

  it("returns 401 without session", async () => {
    setupAuth(mocks.auth, null);

    const formData = new FormData();
    formData.append("file", createTestFile("test.png", "image/png"));

    const req = buildFormDataRequest("/api/upload", formData);
    const res = await uploadPOST(req);
    const { status } = await parseResponse(res);

    expect(status).toBe(401);
  });

  it("returns 400 when no file provided", async () => {
    setupAuth(mocks.auth, mockSession());

    const formData = new FormData();
    const req = buildFormDataRequest("/api/upload", formData);
    const res = await uploadPOST(req);
    const { status, body } = await parseResponse(res);

    expect(status).toBe(400);
    expect(body).toMatchObject({ error: "No file provided" });
  });

  it("returns 400 for disallowed file type", async () => {
    setupAuth(mocks.auth, mockSession());

    const formData = new FormData();
    formData.append(
      "file",
      createTestFile("malware.exe", "application/x-msdownload")
    );

    const req = buildFormDataRequest("/api/upload", formData);
    const res = await uploadPOST(req);
    const { status, body } = await parseResponse(res);

    expect(status).toBe(400);
    expect(body).toMatchObject({ error: "File type not allowed." });
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
