import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "@/app/api/settings/change-email/route";
import { mocks } from "../setup";
import {
  mockSession,
  setupAuth,
  buildRequest,
  parseResponse,
} from "../helpers";

const { isEmailTaken, createPendingEmailChange } =
  await import("@/lib/queries");
const { sendChangeEmailVerification } = await import("@/lib/email");

// ── Tests ───────────────────────────────────────────────────────────────────

describe("POST /api/settings/change-email", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupAuth(mocks.auth, mockSession({ email: "current@test.com" }));
  });

  it("returns 401 without session", async () => {
    setupAuth(mocks.auth, null);

    const req = buildRequest("/api/settings/change-email", {
      method: "POST",
      body: { newEmail: "new@test.com" },
    });
    const res = await POST(req);
    const { status } = await parseResponse(res);

    expect(status).toBe(401);
  });

  it("returns 400 for invalid email", async () => {
    const req = buildRequest("/api/settings/change-email", {
      method: "POST",
      body: { newEmail: "not-an-email" },
    });
    const res = await POST(req);
    const { status } = await parseResponse(res);

    expect(status).toBe(400);
  });

  it("returns 400 when new email matches current", async () => {
    const req = buildRequest("/api/settings/change-email", {
      method: "POST",
      body: { newEmail: "current@test.com" },
    });
    const res = await POST(req);
    const { status, body } = await parseResponse(res);

    expect(status).toBe(400);
    expect(body.error).toContain("different");
  });

  it("returns 409 when email is taken", async () => {
    vi.mocked(isEmailTaken).mockResolvedValueOnce(true);

    const req = buildRequest("/api/settings/change-email", {
      method: "POST",
      body: { newEmail: "taken@test.com" },
    });
    const res = await POST(req);
    const { status, body } = await parseResponse(res);

    expect(status).toBe(409);
    expect(body.error).toContain("already in use");
  });

  it("creates pending change and sends verification email", async () => {
    vi.mocked(isEmailTaken).mockResolvedValueOnce(false);
    vi.mocked(createPendingEmailChange).mockResolvedValueOnce({
      token: "test-token-123",
    });

    const req = buildRequest("/api/settings/change-email", {
      method: "POST",
      body: { newEmail: "new@test.com" },
    });
    const res = await POST(req);
    const { status, body } = await parseResponse(res);

    expect(status).toBe(200);
    expect(body).toEqual({ sent: true });
    expect(createPendingEmailChange).toHaveBeenCalledWith(
      "user-test-001",
      "new@test.com"
    );
    expect(sendChangeEmailVerification).toHaveBeenCalledWith(
      "new@test.com",
      "Test PM",
      expect.stringContaining("test-token-123")
    );
  });
});
