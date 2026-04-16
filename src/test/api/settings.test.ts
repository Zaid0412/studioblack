import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  isEmailTaken,
  createPendingEmailChange,
  getPendingEmailChange,
} from "@/lib/queries";
import { sendChangeEmailVerification } from "@/lib/email";
import { POST as changeEmailPOST } from "@/app/api/settings/change-email/route";
import {
  GET as verifyGET,
  POST as verifyPOST,
} from "@/app/api/settings/verify-email-change/route";
import {
  buildRequest,
  mockSession,
  setupAuth,
  parseResponse,
} from "../helpers";
import { mocks } from "../setup";

// ── POST /api/settings/change-email ─────────────────────────────────────────

describe("POST /api/settings/change-email", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 without session", async () => {
    setupAuth(mocks.auth, null);

    const req = buildRequest("/api/settings/change-email", {
      method: "POST",
      body: { newEmail: "new@test.com" },
    });
    const res = await changeEmailPOST(req);
    const { status } = await parseResponse(res);

    expect(status).toBe(401);
  });

  it("initiates email change successfully", async () => {
    const session = mockSession();
    setupAuth(mocks.auth, session);
    vi.mocked(isEmailTaken).mockResolvedValue(false);
    vi.mocked(createPendingEmailChange).mockResolvedValue({
      token: "abc-token-123",
    });

    const req = buildRequest("/api/settings/change-email", {
      method: "POST",
      body: { newEmail: "new@test.com" },
    });
    const res = await changeEmailPOST(req);
    const { status, body } = await parseResponse(res);

    expect(status).toBe(200);
    expect(body).toEqual({ sent: true });
    expect(isEmailTaken).toHaveBeenCalledWith("new@test.com");
    expect(createPendingEmailChange).toHaveBeenCalledWith(
      session.user.id,
      "new@test.com"
    );
    expect(sendChangeEmailVerification).toHaveBeenCalledWith(
      "new@test.com",
      session.user.name,
      expect.stringContaining("token=abc-token-123")
    );
  });

  it("returns 400 on invalid email", async () => {
    const session = mockSession();
    setupAuth(mocks.auth, session);

    const req = buildRequest("/api/settings/change-email", {
      method: "POST",
      body: { newEmail: "not-an-email" },
    });
    const res = await changeEmailPOST(req);
    const { status, body } = await parseResponse(res);

    expect(status).toBe(400);
    expect(body).toHaveProperty("error");
  });
});

// ── GET /api/settings/verify-email-change ───────────────────────────────────

describe("GET /api/settings/verify-email-change", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns pending change info by token", async () => {
    const token = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11";
    vi.mocked(getPendingEmailChange).mockResolvedValue({
      user_id: "user-1",
      old_email: "old@test.com",
      new_email: "new@test.com",
      token,
      expires_at: new Date(Date.now() + 3600_000).toISOString(),
      failed_attempts: 0,
    } as never);

    const req = buildRequest("/api/settings/verify-email-change", {
      searchParams: { token },
    });
    const res = await verifyGET(req);
    const { status, body } = await parseResponse(res);

    expect(status).toBe(200);
    expect(body).toEqual({
      oldEmail: "old@test.com",
      newEmail: "new@test.com",
    });
    expect(getPendingEmailChange).toHaveBeenCalledWith(token);
  });

  it("returns 400 without token", async () => {
    const req = buildRequest("/api/settings/verify-email-change");
    const res = await verifyGET(req);
    const { status, body } = await parseResponse(res);

    expect(status).toBe(400);
    expect(body).toMatchObject({ error: "Invalid token" });
  });
});

// ── POST /api/settings/verify-email-change ──────────────────────────────────

describe("POST /api/settings/verify-email-change", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 400 without token/password", async () => {
    const req = buildRequest("/api/settings/verify-email-change", {
      method: "POST",
      body: {},
    });
    const res = await verifyPOST(req);
    const { status, body } = await parseResponse(res);

    expect(status).toBe(400);
    expect(body).toHaveProperty("error");
  });

  it("returns 400 for invalid token", async () => {
    const token = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11";
    vi.mocked(getPendingEmailChange).mockResolvedValue(null);

    const req = buildRequest("/api/settings/verify-email-change", {
      method: "POST",
      body: { token, password: "mypassword" },
    });
    const res = await verifyPOST(req);
    const { status, body } = await parseResponse(res);

    expect(status).toBe(400);
    expect(body).toMatchObject({ error: "Invalid or expired link" });
  });
});
