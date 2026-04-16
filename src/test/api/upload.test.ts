import { describe, it, expect, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { POST as uploadPOST } from "@/app/api/upload/route";
import { POST as avatarPOST } from "@/app/api/avatar/route";
import { mocks } from "../setup";
import { mockSession, setupAuth, parseResponse } from "../helpers";

// ── Helpers ─────────────────────────────────────────────────────────────────

const BASE_URL = "http://localhost:3000";

/** Build a NextRequest with FormData body + CSRF headers. */
function buildFormDataRequest(path: string, formData: FormData): NextRequest {
  return new NextRequest(new URL(path, BASE_URL), {
    method: "POST",
    headers: {
      origin: BASE_URL,
      host: "localhost:3000",
    },
    body: formData,
  });
}

/** Create a File-like Blob for FormData. */
function createTestFile(
  name: string,
  type: string,
  sizeBytes: number = 100
): File {
  const buffer = new ArrayBuffer(sizeBytes);
  return new File([buffer], name, { type });
}

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
    mocks.supabase.upload.mockClear();
    mocks.supabase.remove.mockClear();
    mocks.supabase.getPublicUrl.mockClear();
    mocks.supabase.storageFrom.mockClear();
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
    setupAuth(mocks.auth, mockSession());

    const formData = new FormData();
    const req = buildFormDataRequest("/api/avatar", formData);
    const res = await avatarPOST(req);
    const { status, body } = await parseResponse(res);

    expect(status).toBe(400);
    expect(body).toMatchObject({ error: "No file provided" });
  });
});
