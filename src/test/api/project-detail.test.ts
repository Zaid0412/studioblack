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

const { getProjectById, updateProject, deleteProject, getOrgRole } =
  await import("@/lib/queries");

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

  it("restricts architect to name-only updates", async () => {
    vi.mocked(getOrgRole).mockResolvedValue("member");
    vi.mocked(updateProject).mockResolvedValueOnce({
      id: "proj-1",
      name: "New",
    });

    const req = buildRequest("/api/projects/proj-1", {
      method: "PATCH",
      body: { name: "New", status: "completed" },
    });
    const res = await PATCH(req, PARAMS);
    const { status } = await parseResponse(res);

    expect(status).toBe(200);
    // updateProject should only receive name, not status
    expect(updateProject).toHaveBeenCalledWith(
      "proj-1",
      { name: "New" },
      undefined
    );
  });
});

describe("DELETE /api/projects/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupAuth(mocks.auth, mockSession());
    vi.mocked(getOrgRole).mockResolvedValue("owner");
  });

  it("returns 401 without session", async () => {
    setupAuth(mocks.auth, null);
    const req = buildRequest("/api/projects/proj-1", { method: "DELETE" });
    const res = await DELETE(req, PARAMS);
    const { status } = await parseResponse(res);

    expect(status).toBe(401);
  });

  it("returns 403 for non-PM roles", async () => {
    vi.mocked(getOrgRole).mockResolvedValue("member");
    const req = buildRequest("/api/projects/proj-1", { method: "DELETE" });
    const res = await DELETE(req, PARAMS);
    const { status, body } = await parseResponse(res);

    expect(status).toBe(403);
    expect(body.error).toContain("Only PMs");
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
