import { describe, it, expect, vi, beforeEach } from "vitest";
import { getApprovals, createApproval, getOrgRole } from "@/lib/queries";
import { GET, POST } from "@/app/api/projects/[id]/approvals/route";
import {
  buildRequest,
  buildParams,
  mockSession,
  setupAuth,
  parseResponse,
} from "../helpers";
import { mocks } from "../setup";

// ── Fixtures ────────────────────────────────────────────────────────────────

const PROJECT_ID = "proj-1";

const sampleApproval = {
  id: "approval-1",
  project_id: PROJECT_ID,
  phase_id: null,
  user_id: "user-client-001",
  decision: "approved",
  comment: "",
  created_at: "2024-06-01T00:00:00.000Z",
};

// ── GET /api/projects/[id]/approvals ────────────────────────────────────────

describe("GET /api/projects/[id]/approvals", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 without session", async () => {
    setupAuth(mocks.auth, null);

    const req = buildRequest(`/api/projects/${PROJECT_ID}/approvals`);
    const res = await GET(req, buildParams({ id: PROJECT_ID }));
    const { status } = await parseResponse(res);

    expect(status).toBe(401);
  });

  it("returns approvals list", async () => {
    const session = mockSession();
    setupAuth(mocks.auth, session);
    vi.mocked(getApprovals).mockResolvedValue([sampleApproval] as never);

    const req = buildRequest(`/api/projects/${PROJECT_ID}/approvals`);
    const res = await GET(req, buildParams({ id: PROJECT_ID }));
    const { status, body } = await parseResponse(res);

    expect(status).toBe(200);
    expect(body).toEqual([sampleApproval]);
    expect(getApprovals).toHaveBeenCalledWith(PROJECT_ID);
  });
});

// ── POST /api/projects/[id]/approvals ───────────────────────────────────────

describe("POST /api/projects/[id]/approvals", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("client can submit approval", async () => {
    const session = mockSession({ id: "user-client-001", role: "client" });
    setupAuth(mocks.auth, session);
    // withAuth resolves role via getOrgRole — null means no org membership → client
    vi.mocked(getOrgRole).mockResolvedValue(null as never);
    vi.mocked(createApproval).mockResolvedValue(sampleApproval as never);

    const req = buildRequest(`/api/projects/${PROJECT_ID}/approvals`, {
      method: "POST",
      body: { decision: "approved" },
    });
    const res = await POST(req, buildParams({ id: PROJECT_ID }));
    const { status, body } = await parseResponse(res);

    expect(status).toBe(201);
    expect(body).toEqual(sampleApproval);
    expect(createApproval).toHaveBeenCalledWith(
      expect.objectContaining({
        projectId: PROJECT_ID,
        userId: "user-client-001",
        decision: "approved",
      })
    );
  });

  it("non-client gets 403", async () => {
    const session = mockSession();
    setupAuth(mocks.auth, session);
    // Default getOrgRole returns "owner" → PM role → not "client" → 403
    vi.mocked(getOrgRole).mockResolvedValue("owner");

    const req = buildRequest(`/api/projects/${PROJECT_ID}/approvals`, {
      method: "POST",
      body: { decision: "approved" },
    });
    const res = await POST(req, buildParams({ id: PROJECT_ID }));
    const { status } = await parseResponse(res);

    expect(status).toBe(403);
  });

  it("returns 400 on invalid body", async () => {
    const session = mockSession({ id: "user-client-001", role: "client" });
    setupAuth(mocks.auth, session);
    vi.mocked(getOrgRole).mockResolvedValue(null as never);

    const req = buildRequest(`/api/projects/${PROJECT_ID}/approvals`, {
      method: "POST",
      body: { decision: "maybe" },
    });
    const res = await POST(req, buildParams({ id: PROJECT_ID }));
    const { status, body } = await parseResponse(res);

    expect(status).toBe(400);
    expect(body).toHaveProperty("error");
  });
});
