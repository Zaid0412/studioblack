import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  createBoqSection,
  updateBoqSection,
  deleteBoqSection,
  reorderBoqSections,
  verifyBoqOwnership,
  verifyBoqSectionOwnership,
  getOrgRole,
  hasProjectAccess,
} from "@/lib/queries";
import { POST } from "@/app/api/projects/[id]/boq/sections/route";
import {
  PATCH as PATCH_SECTION,
  DELETE as DELETE_SECTION,
} from "@/app/api/projects/[id]/boq/sections/[sectionId]/route";
import { PATCH as PATCH_REORDER } from "@/app/api/projects/[id]/boq/sections/reorder/route";
import {
  buildRequest,
  buildParams,
  mockSession,
  setupAuth,
  parseResponse,
} from "../helpers";
import { mocks } from "../setup";
import type { BoqSection } from "@/types";

// ── Fixtures ────────────────────────────────────────────────────────────────

const PROJECT_ID = "proj-1";
const BOQ_ID = "550e8400-e29b-41d4-a716-446655440000";
const SECTION_ID = "550e8400-e29b-41d4-a716-446655440001";
const SECTION_ID_2 = "550e8400-e29b-41d4-a716-446655440002";

const fakeSection: BoqSection = {
  id: SECTION_ID,
  boq_id: BOQ_ID,
  title: "Civil",
  sort_order: 0,
  description: null,
  budget_cap: null,
  is_visible_to_client: true,
  created_at: "2024-01-01T00:00:00Z",
  updated_at: "2024-01-01T00:00:00Z",
};

const pmSession = mockSession();
const clientSession = mockSession({ role: "client" });

beforeEach(() => {
  vi.clearAllMocks();
  setupAuth(mocks.auth, pmSession);
  vi.mocked(hasProjectAccess).mockResolvedValue(true);
});

// ── POST /api/projects/[id]/boq/sections ────────────────────────────────────

describe("POST /api/projects/[id]/boq/sections", () => {
  it("creates a section", async () => {
    vi.mocked(verifyBoqOwnership).mockResolvedValue(true);
    vi.mocked(createBoqSection).mockResolvedValue(fakeSection);

    const req = buildRequest(`/api/projects/${PROJECT_ID}/boq/sections`, {
      method: "POST",
      body: { boqId: BOQ_ID, title: "Civil" },
    });
    const res = await POST(req, buildParams({ id: PROJECT_ID }));
    const { status, body } = await parseResponse<BoqSection>(res);

    expect(status).toBe(201);
    expect(body.title).toBe("Civil");
    expect(createBoqSection).toHaveBeenCalledWith(
      BOQ_ID,
      expect.objectContaining({ title: "Civil" })
    );
  });

  it("returns 400 when boqId is missing", async () => {
    const req = buildRequest(`/api/projects/${PROJECT_ID}/boq/sections`, {
      method: "POST",
      body: { title: "Civil" },
    });
    const res = await POST(req, buildParams({ id: PROJECT_ID }));
    const { status } = await parseResponse(res);

    expect(status).toBe(400);
    expect(verifyBoqOwnership).not.toHaveBeenCalled();
  });

  it("returns 404 when BOQ is not owned by project", async () => {
    vi.mocked(verifyBoqOwnership).mockResolvedValue(false);

    const req = buildRequest(`/api/projects/${PROJECT_ID}/boq/sections`, {
      method: "POST",
      body: { boqId: BOQ_ID, title: "Civil" },
    });
    const res = await POST(req, buildParams({ id: PROJECT_ID }));
    const { status } = await parseResponse(res);

    expect(status).toBe(404);
    expect(createBoqSection).not.toHaveBeenCalled();
  });

  it("returns 400 when title is empty", async () => {
    vi.mocked(verifyBoqOwnership).mockResolvedValue(true);

    const req = buildRequest(`/api/projects/${PROJECT_ID}/boq/sections`, {
      method: "POST",
      body: { boqId: BOQ_ID, title: "" },
    });
    const res = await POST(req, buildParams({ id: PROJECT_ID }));
    const { status } = await parseResponse(res);

    expect(status).toBe(400);
  });

  it("returns 403 for client role", async () => {
    setupAuth(mocks.auth, clientSession);
    vi.mocked(getOrgRole).mockResolvedValue(null as never);

    const req = buildRequest(`/api/projects/${PROJECT_ID}/boq/sections`, {
      method: "POST",
      body: { boqId: BOQ_ID, title: "Civil" },
    });
    const res = await POST(req, buildParams({ id: PROJECT_ID }));
    const { status } = await parseResponse(res);

    expect(status).toBe(403);
  });
});

// ── PATCH /api/projects/[id]/boq/sections/[sectionId] ───────────────────────

describe("PATCH /api/projects/[id]/boq/sections/[sectionId]", () => {
  it("updates section fields", async () => {
    vi.mocked(verifyBoqSectionOwnership).mockResolvedValue(true);
    vi.mocked(updateBoqSection).mockResolvedValue({
      ...fakeSection,
      title: "Renamed",
    });

    const req = buildRequest(
      `/api/projects/${PROJECT_ID}/boq/sections/${SECTION_ID}`,
      { method: "PATCH", body: { title: "Renamed" } }
    );
    const res = await PATCH_SECTION(
      req,
      buildParams({ id: PROJECT_ID, sectionId: SECTION_ID })
    );
    const { status, body } = await parseResponse<BoqSection>(res);

    expect(status).toBe(200);
    expect(body.title).toBe("Renamed");
    expect(verifyBoqSectionOwnership).toHaveBeenCalledWith(
      SECTION_ID,
      PROJECT_ID
    );
  });

  it("returns 404 when section is not owned by project", async () => {
    vi.mocked(verifyBoqSectionOwnership).mockResolvedValue(false);

    const req = buildRequest(
      `/api/projects/${PROJECT_ID}/boq/sections/${SECTION_ID}`,
      { method: "PATCH", body: { title: "X" } }
    );
    const res = await PATCH_SECTION(
      req,
      buildParams({ id: PROJECT_ID, sectionId: SECTION_ID })
    );
    const { status } = await parseResponse(res);

    expect(status).toBe(404);
  });

  it("returns 400 when no fields provided", async () => {
    vi.mocked(verifyBoqSectionOwnership).mockResolvedValue(true);
    vi.mocked(updateBoqSection).mockResolvedValue(null);

    const req = buildRequest(
      `/api/projects/${PROJECT_ID}/boq/sections/${SECTION_ID}`,
      { method: "PATCH", body: {} }
    );
    const res = await PATCH_SECTION(
      req,
      buildParams({ id: PROJECT_ID, sectionId: SECTION_ID })
    );
    const { status } = await parseResponse(res);

    expect(status).toBe(400);
  });

  it("returns 400 on negative budgetCap", async () => {
    vi.mocked(verifyBoqSectionOwnership).mockResolvedValue(true);

    const req = buildRequest(
      `/api/projects/${PROJECT_ID}/boq/sections/${SECTION_ID}`,
      { method: "PATCH", body: { budgetCap: -10 } }
    );
    const res = await PATCH_SECTION(
      req,
      buildParams({ id: PROJECT_ID, sectionId: SECTION_ID })
    );
    const { status } = await parseResponse(res);

    expect(status).toBe(400);
  });

  it("returns 403 for client role", async () => {
    setupAuth(mocks.auth, clientSession);
    vi.mocked(getOrgRole).mockResolvedValue(null as never);

    const req = buildRequest(
      `/api/projects/${PROJECT_ID}/boq/sections/${SECTION_ID}`,
      { method: "PATCH", body: { title: "X" } }
    );
    const res = await PATCH_SECTION(
      req,
      buildParams({ id: PROJECT_ID, sectionId: SECTION_ID })
    );
    const { status } = await parseResponse(res);

    expect(status).toBe(403);
  });
});

// ── DELETE /api/projects/[id]/boq/sections/[sectionId] ──────────────────────

describe("DELETE /api/projects/[id]/boq/sections/[sectionId]", () => {
  it("deletes a section (items orphan to null section_id)", async () => {
    vi.mocked(verifyBoqSectionOwnership).mockResolvedValue(true);
    vi.mocked(deleteBoqSection).mockResolvedValue(true);

    const req = buildRequest(
      `/api/projects/${PROJECT_ID}/boq/sections/${SECTION_ID}`,
      { method: "DELETE" }
    );
    const res = await DELETE_SECTION(
      req,
      buildParams({ id: PROJECT_ID, sectionId: SECTION_ID })
    );
    const { status, body } = await parseResponse<{ ok: boolean }>(res);

    expect(status).toBe(200);
    expect(body.ok).toBe(true);
    expect(deleteBoqSection).toHaveBeenCalledWith(SECTION_ID, false);
  });

  it("cascade-deletes the section + its items when ?cascade=true", async () => {
    vi.mocked(verifyBoqSectionOwnership).mockResolvedValue(true);
    vi.mocked(deleteBoqSection).mockResolvedValue(true);

    const req = buildRequest(
      `/api/projects/${PROJECT_ID}/boq/sections/${SECTION_ID}?cascade=true`,
      { method: "DELETE" }
    );
    const res = await DELETE_SECTION(
      req,
      buildParams({ id: PROJECT_ID, sectionId: SECTION_ID })
    );
    const { status, body } = await parseResponse<{ ok: boolean }>(res);

    expect(status).toBe(200);
    expect(body.ok).toBe(true);
    expect(deleteBoqSection).toHaveBeenCalledWith(SECTION_ID, true);
  });

  it("returns 404 when section is not owned by project", async () => {
    vi.mocked(verifyBoqSectionOwnership).mockResolvedValue(false);

    const req = buildRequest(
      `/api/projects/${PROJECT_ID}/boq/sections/${SECTION_ID}`,
      { method: "DELETE" }
    );
    const res = await DELETE_SECTION(
      req,
      buildParams({ id: PROJECT_ID, sectionId: SECTION_ID })
    );
    const { status } = await parseResponse(res);

    expect(status).toBe(404);
  });

  it("returns 404 when row no longer exists", async () => {
    vi.mocked(verifyBoqSectionOwnership).mockResolvedValue(true);
    vi.mocked(deleteBoqSection).mockResolvedValue(false);

    const req = buildRequest(
      `/api/projects/${PROJECT_ID}/boq/sections/${SECTION_ID}`,
      { method: "DELETE" }
    );
    const res = await DELETE_SECTION(
      req,
      buildParams({ id: PROJECT_ID, sectionId: SECTION_ID })
    );
    const { status } = await parseResponse(res);

    expect(status).toBe(404);
  });

  it("returns 403 for client role", async () => {
    setupAuth(mocks.auth, clientSession);
    vi.mocked(getOrgRole).mockResolvedValue(null as never);

    const req = buildRequest(
      `/api/projects/${PROJECT_ID}/boq/sections/${SECTION_ID}`,
      { method: "DELETE" }
    );
    const res = await DELETE_SECTION(
      req,
      buildParams({ id: PROJECT_ID, sectionId: SECTION_ID })
    );
    const { status } = await parseResponse(res);

    expect(status).toBe(403);
  });
});

// ── PATCH /api/projects/[id]/boq/sections/reorder ───────────────────────────

describe("PATCH /api/projects/[id]/boq/sections/reorder", () => {
  it("reorders sections within a BOQ", async () => {
    vi.mocked(verifyBoqOwnership).mockResolvedValue(true);

    const req = buildRequest(
      `/api/projects/${PROJECT_ID}/boq/sections/reorder`,
      {
        method: "PATCH",
        body: { boqId: BOQ_ID, orderedIds: [SECTION_ID_2, SECTION_ID] },
      }
    );
    const res = await PATCH_REORDER(req, buildParams({ id: PROJECT_ID }));
    const { status, body } = await parseResponse<{ ok: boolean }>(res);

    expect(status).toBe(200);
    expect(body.ok).toBe(true);
    expect(reorderBoqSections).toHaveBeenCalledWith(BOQ_ID, [
      SECTION_ID_2,
      SECTION_ID,
    ]);
  });

  it("returns 400 when boqId is missing", async () => {
    const req = buildRequest(
      `/api/projects/${PROJECT_ID}/boq/sections/reorder`,
      { method: "PATCH", body: { orderedIds: [SECTION_ID] } }
    );
    const res = await PATCH_REORDER(req, buildParams({ id: PROJECT_ID }));
    const { status } = await parseResponse(res);

    expect(status).toBe(400);
  });

  it("returns 404 when BOQ not owned by project", async () => {
    vi.mocked(verifyBoqOwnership).mockResolvedValue(false);

    const req = buildRequest(
      `/api/projects/${PROJECT_ID}/boq/sections/reorder`,
      {
        method: "PATCH",
        body: { boqId: BOQ_ID, orderedIds: [SECTION_ID] },
      }
    );
    const res = await PATCH_REORDER(req, buildParams({ id: PROJECT_ID }));
    const { status } = await parseResponse(res);

    expect(status).toBe(404);
  });

  it("returns 400 when orderedIds is empty", async () => {
    vi.mocked(verifyBoqOwnership).mockResolvedValue(true);

    const req = buildRequest(
      `/api/projects/${PROJECT_ID}/boq/sections/reorder`,
      { method: "PATCH", body: { boqId: BOQ_ID, orderedIds: [] } }
    );
    const res = await PATCH_REORDER(req, buildParams({ id: PROJECT_ID }));
    const { status } = await parseResponse(res);

    expect(status).toBe(400);
  });

  it("returns 400 when orderedIds contain non-uuid values", async () => {
    vi.mocked(verifyBoqOwnership).mockResolvedValue(true);

    const req = buildRequest(
      `/api/projects/${PROJECT_ID}/boq/sections/reorder`,
      {
        method: "PATCH",
        body: { boqId: BOQ_ID, orderedIds: ["not-a-uuid"] },
      }
    );
    const res = await PATCH_REORDER(req, buildParams({ id: PROJECT_ID }));
    const { status } = await parseResponse(res);

    expect(status).toBe(400);
  });

  it("returns 403 for client role", async () => {
    setupAuth(mocks.auth, clientSession);
    vi.mocked(getOrgRole).mockResolvedValue(null as never);

    const req = buildRequest(
      `/api/projects/${PROJECT_ID}/boq/sections/reorder`,
      {
        method: "PATCH",
        body: { boqId: BOQ_ID, orderedIds: [SECTION_ID] },
      }
    );
    const res = await PATCH_REORDER(req, buildParams({ id: PROJECT_ID }));
    const { status } = await parseResponse(res);

    expect(status).toBe(403);
  });
});
