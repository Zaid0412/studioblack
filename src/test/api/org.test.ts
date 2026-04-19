import { describe, it, expect, vi, beforeEach } from "vitest";
import { clearClientEmailByEmail } from "@/lib/queries";
import { POST } from "@/app/api/org/clear-client/route";
import {
  buildRequest,
  mockSession,
  setupAuth,
  parseResponse,
} from "../helpers";
import { mocks } from "../setup";

// ── POST /api/org/clear-client ──────────────────────────────────────────────

describe("POST /api/org/clear-client", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 without session", async () => {
    setupAuth(mocks.auth, null);

    const req = buildRequest("/api/org/clear-client", {
      method: "POST",
      body: { email: "client@test.com" },
    });
    const res = await POST(req);
    const { status } = await parseResponse(res);

    expect(status).toBe(401);
  });

  it("clears client email successfully", async () => {
    const session = mockSession();
    setupAuth(mocks.auth, session);

    // Mock the direct DB query for org role check — returns owner
    mocks.db.query.mockResolvedValueOnce({
      rows: [{ role: "owner" }],
      rowCount: 1,
    });

    vi.mocked(clearClientEmailByEmail).mockResolvedValue(2 as never);

    const req = buildRequest("/api/org/clear-client", {
      method: "POST",
      body: { email: "client@test.com" },
    });
    const res = await POST(req);
    const { status, body } = await parseResponse(res);

    expect(status).toBe(200);
    expect(body).toEqual({ cleared: 2 });
    expect(clearClientEmailByEmail).toHaveBeenCalledWith("client@test.com");
  });

  it("client is blocked (403)", async () => {
    const session = mockSession({ role: "client" });
    setupAuth(mocks.auth, session);

    const req = buildRequest("/api/org/clear-client", {
      method: "POST",
      body: { email: "client@test.com" },
    });
    const res = await POST(req);
    const { status } = await parseResponse(res);

    expect(status).toBe(403);
  });
});
