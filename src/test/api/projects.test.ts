import { describe, it, expect, vi, beforeEach } from "vitest";
import { auth } from "@/lib/auth";
import {
  getProjectsByOrgId,
  getProjectsByArchitectId,
  getProjectById,
  createProjectWithPhases,
  updateProject,
  deleteProject,
} from "@/lib/queries";
import { GET, POST } from "@/app/api/projects/route";
import { GET as GET_BY_ID, PATCH, DELETE } from "@/app/api/projects/[id]/route";
import {
  buildRequest,
  buildParams,
  mockSession,
  setupAuth,
  parseResponse,
  TEST_ORG_ID,
  TEST_USER_ID,
} from "../helpers";
import { mocks } from "../setup";

// ── Fixtures ────────────────────────────────────────────────────────────────

const sampleProject = {
  id: "proj-1",
  name: "Test Project",
  org_id: TEST_ORG_ID,
  created_by: TEST_USER_ID,
  category: "residential",
  status: "active",
};

const validCreateBody = {
  name: "New Project",
  category: "residential",
  clientName: "Client A",
};

// ── GET /api/projects ───────────────────────────────────────────────────────

describe("GET /api/projects", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 without session", async () => {
    setupAuth(mocks.auth, null);

    const req = buildRequest("/api/projects");
    const res = await GET(req);
    const { status } = await parseResponse(res);

    expect(status).toBe(401);
  });

  it("returns projects for PM (calls getProjectsByOrgId)", async () => {
    const session = mockSession();
    setupAuth(mocks.auth, session);
    vi.mocked(auth.api.listMembers).mockResolvedValue({
      members: [{ userId: TEST_USER_ID, role: "owner" }],
    } as never);
    vi.mocked(getProjectsByOrgId).mockResolvedValue([sampleProject] as never);

    const req = buildRequest("/api/projects");
    const res = await GET(req);
    const { status, body } = await parseResponse(res);

    expect(status).toBe(200);
    expect(body).toEqual([sampleProject]);
    expect(getProjectsByOrgId).toHaveBeenCalledWith(TEST_ORG_ID);
    expect(getProjectsByArchitectId).not.toHaveBeenCalled();
  });

  it("returns projects for architect (calls getProjectsByArchitectId)", async () => {
    const session = mockSession();
    setupAuth(mocks.auth, session);
    vi.mocked(auth.api.listMembers).mockResolvedValue({
      members: [{ userId: TEST_USER_ID, role: "member" }],
    } as never);
    vi.mocked(getProjectsByArchitectId).mockResolvedValue([
      sampleProject,
    ] as never);

    const req = buildRequest("/api/projects");
    const res = await GET(req);
    const { status, body } = await parseResponse(res);

    expect(status).toBe(200);
    expect(body).toEqual([sampleProject]);
    expect(getProjectsByArchitectId).toHaveBeenCalledWith(
      TEST_USER_ID,
      TEST_ORG_ID
    );
    expect(getProjectsByOrgId).not.toHaveBeenCalled();
  });

  it("returns 400 when no org found", async () => {
    const session = mockSession({}, { activeOrganizationId: null });
    setupAuth(mocks.auth, session);
    // listOrganizations returns empty (setupAuth handles this when activeOrganizationId is null)

    const req = buildRequest("/api/projects");
    const res = await GET(req);
    const { status, body } = await parseResponse(res);

    expect(status).toBe(400);
    expect(body).toMatchObject({ error: "No active organization" });
  });
});

// ── POST /api/projects ──────────────────────────────────────────────────────

describe("POST /api/projects", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 403 for non-PM role", async () => {
    const session = mockSession({ role: "architect" });
    setupAuth(mocks.auth, session);
    // withAuth({ allowedRoles: ["pm"] }) blocks non-PM users
    // The role derivation in withAuth uses getOrgRole which returns "member" by default
    // Override getOrgRole to return "member" so role resolves to architect
    const { getOrgRole } = await import("@/lib/queries");
    vi.mocked(getOrgRole).mockResolvedValue("member");

    const req = buildRequest("/api/projects", {
      method: "POST",
      body: validCreateBody,
    });
    const res = await POST(req);
    const { status } = await parseResponse(res);

    expect(status).toBe(403);
  });

  it("creates project with valid body, returns 201", async () => {
    const session = mockSession();
    setupAuth(mocks.auth, session);
    vi.mocked(createProjectWithPhases).mockResolvedValue(
      sampleProject as never
    );

    const req = buildRequest("/api/projects", {
      method: "POST",
      body: validCreateBody,
    });
    const res = await POST(req);
    const { status, body } = await parseResponse(res);

    expect(status).toBe(201);
    expect(body).toEqual(sampleProject);
    expect(createProjectWithPhases).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "New Project",
        category: "residential",
        orgId: TEST_ORG_ID,
        createdBy: TEST_USER_ID,
      })
    );
  });

  it("returns 500 when createProjectWithPhases throws", async () => {
    const session = mockSession();
    setupAuth(mocks.auth, session);
    vi.mocked(createProjectWithPhases).mockRejectedValue(
      new Error("DB connection lost")
    );

    const req = buildRequest("/api/projects", {
      method: "POST",
      body: validCreateBody,
    });
    const res = await POST(req);
    const { status, body } = await parseResponse(res);

    expect(status).toBe(500);
    expect(body).toMatchObject({ error: "Failed to create project" });
  });

  it("returns 400 on invalid body (missing name)", async () => {
    const session = mockSession();
    setupAuth(mocks.auth, session);

    const req = buildRequest("/api/projects", {
      method: "POST",
      body: { category: "residential" },
    });
    const res = await POST(req);
    const { status, body } = await parseResponse(res);

    expect(status).toBe(400);
    expect(body).toHaveProperty("error");
  });
});

// ── GET /api/projects/[id] ──────────────────────────────────────────────────

describe("GET /api/projects/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns project when found", async () => {
    const session = mockSession();
    setupAuth(mocks.auth, session);
    vi.mocked(getProjectById).mockResolvedValue(sampleProject as never);

    const req = buildRequest("/api/projects/proj-1");
    const res = await GET_BY_ID(req, buildParams({ id: "proj-1" }));
    const { status, body } = await parseResponse(res);

    expect(status).toBe(200);
    expect(body).toEqual(sampleProject);
    expect(getProjectById).toHaveBeenCalledWith("proj-1");
  });

  it("returns 404 when not found", async () => {
    const session = mockSession();
    setupAuth(mocks.auth, session);
    vi.mocked(getProjectById).mockResolvedValue(null as never);

    const req = buildRequest("/api/projects/proj-999");
    const res = await GET_BY_ID(req, buildParams({ id: "proj-999" }));
    const { status, body } = await parseResponse(res);

    expect(status).toBe(404);
    expect(body).toMatchObject({ error: "Not found" });
  });
});

// ── PATCH /api/projects/[id] ────────────────────────────────────────────────

describe("PATCH /api/projects/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("PM can update all fields", async () => {
    const session = mockSession();
    setupAuth(mocks.auth, session);
    const { getOrgRole } = await import("@/lib/queries");
    vi.mocked(getOrgRole).mockResolvedValue("owner");
    const updated = { ...sampleProject, name: "Updated", status: "completed" };
    vi.mocked(updateProject).mockResolvedValue(updated as never);

    const req = buildRequest("/api/projects/proj-1", {
      method: "PATCH",
      body: { name: "Updated", status: "completed" },
    });
    const res = await PATCH(req, buildParams({ id: "proj-1" }));
    const { status, body } = await parseResponse(res);

    expect(status).toBe(200);
    expect(body).toEqual(updated);
    expect(updateProject).toHaveBeenCalledWith(
      "proj-1",
      expect.objectContaining({ name: "Updated", status: "completed" }),
      undefined
    );
  });

  it("architect can only update name", async () => {
    const session = mockSession({ role: "architect" });
    setupAuth(mocks.auth, session);
    const { getOrgRole } = await import("@/lib/queries");
    vi.mocked(getOrgRole).mockResolvedValue("member");
    const updated = { ...sampleProject, name: "Renamed" };
    vi.mocked(updateProject).mockResolvedValue(updated as never);

    const req = buildRequest("/api/projects/proj-1", {
      method: "PATCH",
      body: { name: "Renamed", status: "completed" },
    });
    const res = await PATCH(req, buildParams({ id: "proj-1" }));
    const { status, body } = await parseResponse(res);

    expect(status).toBe(200);
    expect(body).toEqual(updated);
    // Only name should be passed, not status
    expect(updateProject).toHaveBeenCalledWith(
      "proj-1",
      { name: "Renamed" },
      undefined
    );
  });

  it("client is blocked (403)", async () => {
    const session = mockSession({ role: "client" });
    setupAuth(mocks.auth, session);
    // withAuth({ blockedRoles: ["client"] }) — need the role derivation to return "client"
    const { getOrgRole } = await import("@/lib/queries");
    vi.mocked(getOrgRole).mockResolvedValue(null as never);
    // hasProjectAccess returns true but user matched via client_email
    const { hasProjectAccess } = await import("@/lib/queries");
    vi.mocked(hasProjectAccess).mockResolvedValue(true);

    const req = buildRequest("/api/projects/proj-1", {
      method: "PATCH",
      body: { name: "Hacked" },
    });
    const res = await PATCH(req, buildParams({ id: "proj-1" }));
    const { status } = await parseResponse(res);

    expect(status).toBe(403);
  });

  it("returns 400 when no fields to update", async () => {
    const session = mockSession();
    setupAuth(mocks.auth, session);
    const { getOrgRole } = await import("@/lib/queries");
    vi.mocked(getOrgRole).mockResolvedValue("owner");

    const req = buildRequest("/api/projects/proj-1", {
      method: "PATCH",
      body: {},
    });
    const res = await PATCH(req, buildParams({ id: "proj-1" }));
    const { status, body } = await parseResponse(res);

    expect(status).toBe(400);
    expect(body).toMatchObject({ error: "No fields to update" });
  });
});

// ── DELETE /api/projects/[id] ───────────────────────────────────────────────

describe("DELETE /api/projects/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("PM (owner) can delete", async () => {
    const session = mockSession();
    setupAuth(mocks.auth, session);
    const { getOrgRole } = await import("@/lib/queries");
    vi.mocked(getOrgRole).mockResolvedValue("owner");
    vi.mocked(deleteProject).mockResolvedValue(sampleProject as never);

    const req = buildRequest("/api/projects/proj-1", { method: "DELETE" });
    const res = await DELETE(req, buildParams({ id: "proj-1" }));
    const { status, body } = await parseResponse(res);

    expect(status).toBe(200);
    expect(body).toMatchObject({ success: true });
    expect(deleteProject).toHaveBeenCalledWith("proj-1");
  });

  it("non-PM (member role) gets 403", async () => {
    const session = mockSession({ role: "architect" });
    setupAuth(mocks.auth, session);
    const { getOrgRole } = await import("@/lib/queries");
    vi.mocked(getOrgRole).mockResolvedValue("member");

    const req = buildRequest("/api/projects/proj-1", { method: "DELETE" });
    const res = await DELETE(req, buildParams({ id: "proj-1" }));
    const { status } = await parseResponse(res);

    expect(status).toBe(403);
  });

  it("returns 404 when project not found", async () => {
    const session = mockSession();
    setupAuth(mocks.auth, session);
    const { getOrgRole } = await import("@/lib/queries");
    vi.mocked(getOrgRole).mockResolvedValue("owner");
    vi.mocked(deleteProject).mockResolvedValue(null as never);

    const req = buildRequest("/api/projects/proj-999", { method: "DELETE" });
    const res = await DELETE(req, buildParams({ id: "proj-999" }));
    const { status, body } = await parseResponse(res);

    expect(status).toBe(404);
    expect(body).toMatchObject({ error: "Not found" });
  });
});
