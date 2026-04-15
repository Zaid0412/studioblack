import { describe, it, expect, vi, beforeEach } from "vitest";
import { getProjectsByClientEmail } from "@/lib/queries";
import { GET } from "@/app/api/client/projects/route";
import {
  buildRequest,
  mockSession,
  setupAuth,
  parseResponse,
} from "../helpers";
import { mocks } from "../setup";

// ── GET /api/client/projects ────────────────────────────────────────────────

describe("GET /api/client/projects", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 403 for non-client role", async () => {
    const session = mockSession({ role: "pm" });
    setupAuth(mocks.auth, session);

    const req = buildRequest("/api/client/projects");
    const res = await GET(req);
    const { status } = await parseResponse(res);

    expect(status).toBe(403);
  });

  it("returns projects for client", async () => {
    const session = mockSession({
      role: "client",
      email: "client@test.com",
      name: "Test Client",
    });
    setupAuth(mocks.auth, session);

    const clientProjects = [
      { id: "proj-1", name: "Client Project 1", status: "active" },
      { id: "proj-2", name: "Client Project 2", status: "completed" },
    ];
    vi.mocked(getProjectsByClientEmail).mockResolvedValue(
      clientProjects as never
    );

    const req = buildRequest("/api/client/projects");
    const res = await GET(req);
    const { status, body } = await parseResponse(res);

    expect(status).toBe(200);
    expect(body).toEqual(clientProjects);
    expect(getProjectsByClientEmail).toHaveBeenCalledWith("client@test.com");
  });
});
