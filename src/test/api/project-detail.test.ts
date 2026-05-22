import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET, PATCH, DELETE } from "@/app/api/projects/[id]/route";
import { mocks } from "../setup";
import {
  mockSession,
  setupAuth,
  buildRequest,
  buildParams,
  parseResponse,
} from "../helpers";

const {
  getProjectById,
  updateProject,
  deleteProject,
  getOrgRole,
  getMemberRole,
} = await import("@/lib/queries");

const PARAMS = buildParams({ id: "proj-1" });

// ── Tests ───────────────────────────────────────────────────────────────────

describe("GET /api/projects/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupAuth(mocks.auth, mockSession());
  });

  it("returns 401 without session", async () => {
    setupAuth(mocks.auth, null);
    const req = buildRequest("/api/projects/proj-1");
    const res = await GET(req, PARAMS);
    const { status } = await parseResponse(res);

    expect(status).toBe(401);
  });

  it("returns 404 when project not found", async () => {
    vi.mocked(getProjectById).mockResolvedValueOnce(null);
    const req = buildRequest("/api/projects/proj-1");
    const res = await GET(req, PARAMS);
    const { status, body } = await parseResponse(res);

    expect(status).toBe(404);
    expect(body).toMatchObject({ error: "Not found" });
  });

  it("returns project data", async () => {
    const project = { id: "proj-1", name: "Test Project", status: "active" };
    vi.mocked(getProjectById).mockResolvedValueOnce(project);

    const req = buildRequest("/api/projects/proj-1");
    const res = await GET(req, PARAMS);
    const { status, body } = await parseResponse(res);

    expect(status).toBe(200);
    expect(body).toMatchObject({ id: "proj-1", name: "Test Project" });
  });
});

describe("PATCH /api/projects/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupAuth(mocks.auth, mockSession());
    vi.mocked(getOrgRole).mockResolvedValue("owner");
  });

  it("returns 401 without session", async () => {
    setupAuth(mocks.auth, null);
    const req = buildRequest("/api/projects/proj-1", {
      method: "PATCH",
      body: { name: "New Name" },
    });
    const res = await PATCH(req, PARAMS);
    const { status } = await parseResponse(res);

    expect(status).toBe(401);
  });

  it("returns 400 when no fields to update", async () => {
    const req = buildRequest("/api/projects/proj-1", {
      method: "PATCH",
      body: {},
    });
    const res = await PATCH(req, PARAMS);
    const { status, body } = await parseResponse(res);

    expect(status).toBe(400);
    expect(body.error).toContain("No fields");
  });

  it("updates project name for PM", async () => {
    const updated = { id: "proj-1", name: "Updated" };
    vi.mocked(updateProject).mockResolvedValueOnce(updated);

    const req = buildRequest("/api/projects/proj-1", {
      method: "PATCH",
      body: { name: "Updated" },
    });
    const res = await PATCH(req, PARAMS);
    const { status, body } = await parseResponse(res);

    expect(status).toBe(200);
    expect(body.name).toBe("Updated");
  });

  it("blocks architect from editing the project", async () => {
    vi.mocked(getOrgRole).mockResolvedValue("member");
    // `effectiveRole` is driven by `getMemberRole`. Drive it to "member" with
    // no project-PM row so the route rejects the architect with 403.
    vi.mocked(getMemberRole).mockResolvedValue("member");

    const req = buildRequest("/api/projects/proj-1", {
      method: "PATCH",
      body: { name: "New", status: "completed" },
    });
    const res = await PATCH(req, PARAMS);

    expect(res.status).toBe(403);
    expect(updateProject).not.toHaveBeenCalled();
  });
});

describe("DELETE /api/projects/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupAuth(mocks.auth, mockSession());
    vi.mocked(getOrgRole).mockResolvedValue("owner");
    // Re-pin getMemberRole because `vi.clearAllMocks()` doesn't restore
    // implementations overridden by an earlier test in the file.
    vi.mocked(getMemberRole).mockResolvedValue("owner");
  });

  it("returns 401 without session", async () => {
    setupAuth(mocks.auth, null);
    const req = buildRequest("/api/projects/proj-1", { method: "DELETE" });
    const res = await DELETE(req, PARAMS);
    const { status } = await parseResponse(res);

    expect(status).toBe(401);
  });

  it("returns 403 for non-PM roles", async () => {
    // Effective role drives DELETE access via `allowedRoles: ["pm"]` now.
    vi.mocked(getMemberRole).mockResolvedValue("member");
    const req = buildRequest("/api/projects/proj-1", { method: "DELETE" });
    const res = await DELETE(req, PARAMS);
    const { status, body } = await parseResponse(res);

    expect(status).toBe(403);
    // Message is generic now — withAuth's role-gate returns "Forbidden"
    // instead of the route's previous custom string.
    expect(body.error).toBe("Forbidden");
  });

  it("returns 404 when project not found", async () => {
    vi.mocked(deleteProject).mockResolvedValueOnce(null);
    const req = buildRequest("/api/projects/proj-1", { method: "DELETE" });
    const res = await DELETE(req, PARAMS);
    const { status } = await parseResponse(res);

    expect(status).toBe(404);
  });

  it("deletes project successfully", async () => {
    vi.mocked(deleteProject).mockResolvedValueOnce({ id: "proj-1" });
    const req = buildRequest("/api/projects/proj-1", { method: "DELETE" });
    const res = await DELETE(req, PARAMS);
    const { status, body } = await parseResponse(res);

    expect(status).toBe(200);
    expect(body).toEqual({ success: true });
  });
});
