import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  createBoq,
  getBoq,
  getBoqByProject,
  updateBoq,
  verifyBoqOwnership,
  getBoqStatus,
  hasProjectAccess,
  getOrgRole,
} from "@/lib/queries";
import { GET, POST, PATCH } from "@/app/api/projects/[id]/boq/route";
import { GET as GET_SUMMARY } from "@/app/api/projects/[id]/boq/summary/route";
import {
  buildRequest,
  buildParams,
  mockSession,
  setupAuth,
  parseResponse,
} from "../helpers";
import { mocks } from "../setup";
import type { Boq, BoqSummary, BoqWithDetails } from "@/types";

// ── Fixtures ────────────────────────────────────────────────────────────────

const PROJECT_ID = "proj-1";
const BOQ_ID = "550e8400-e29b-41d4-a716-446655440000";

const fakeBoq: Boq = {
  id: BOQ_ID,
  project_id: PROJECT_ID,
  title: "Main BOQ",
  version: 1,
  status: "draft",
  currency: "USD",
  exchange_rate: "1",
  contingency_pct: "5",
  vat_pct: "18",
  minimum_margin_pct: "10",
  client_id: null,
  architect_id: null,
  issued_date: null,
  approved_date: null,
  notes: null,
  client_notes: null,
  snapshot: null,
  created_by: "user-test-001",
  created_at: "2024-01-01T00:00:00Z",
  updated_at: "2024-01-01T00:00:00Z",
};

const fakeSummary: BoqSummary = {
  total_cost: "1000",
  total_sell_price: "1500",
  subtotal: "1500",
  pre_vat_total: "1575",
  client_total: "1858.50",
  average_margin_pct: "33.33",
  margin_bleed_count: 0,
  pending_approvals: 0,
  item_count: 3,
  section_totals: [],
};

const fakeFullBoq: BoqWithDetails = {
  ...fakeBoq,
  sections: [],
  items: [],
  summary: fakeSummary,
};

const pmSession = mockSession();
const clientSession = mockSession({ role: "client" });

beforeEach(() => {
  vi.clearAllMocks();
  setupAuth(mocks.auth, pmSession);
  vi.mocked(hasProjectAccess).mockResolvedValue(true);
  vi.mocked(getBoqStatus).mockResolvedValue("draft");
});

// ── GET /api/projects/[id]/boq ──────────────────────────────────────────────

describe("GET /api/projects/[id]/boq", () => {
  it("returns the full BOQ payload", async () => {
    vi.mocked(getBoqByProject).mockResolvedValue(fakeBoq);
    vi.mocked(getBoq).mockResolvedValue(fakeFullBoq);

    const req = buildRequest(`/api/projects/${PROJECT_ID}/boq`);
    const res = await GET(req, buildParams({ id: PROJECT_ID }));
    const { status, body } = await parseResponse<BoqWithDetails>(res);

    expect(status).toBe(200);
    expect(body.id).toBe(BOQ_ID);
    expect(body.summary.item_count).toBe(3);
    expect(getBoq).toHaveBeenCalledWith(BOQ_ID);
  });

  it("returns 404 when no BOQ exists for project", async () => {
    vi.mocked(getBoqByProject).mockResolvedValue(null);

    const req = buildRequest(`/api/projects/${PROJECT_ID}/boq`);
    const res = await GET(req, buildParams({ id: PROJECT_ID }));
    const { status } = await parseResponse(res);

    expect(status).toBe(404);
  });

  it("returns 401 without session", async () => {
    setupAuth(mocks.auth, null);

    const req = buildRequest(`/api/projects/${PROJECT_ID}/boq`);
    const res = await GET(req, buildParams({ id: PROJECT_ID }));
    const { status } = await parseResponse(res);

    expect(status).toBe(401);
  });

  it("returns 403 when user has no project access", async () => {
    vi.mocked(hasProjectAccess).mockResolvedValue(false);

    const req = buildRequest(`/api/projects/${PROJECT_ID}/boq`);
    const res = await GET(req, buildParams({ id: PROJECT_ID }));
    const { status } = await parseResponse(res);

    expect(status).toBe(403);
  });

  it("allows client role to GET the BOQ", async () => {
    setupAuth(mocks.auth, clientSession);
    vi.mocked(getOrgRole).mockResolvedValue(null as never);
    vi.mocked(getBoqByProject).mockResolvedValue(fakeBoq);
    vi.mocked(getBoq).mockResolvedValue(fakeFullBoq);

    const req = buildRequest(`/api/projects/${PROJECT_ID}/boq`);
    const res = await GET(req, buildParams({ id: PROJECT_ID }));
    const { status } = await parseResponse(res);

    expect(status).toBe(200);
  });
});

// ── POST /api/projects/[id]/boq ─────────────────────────────────────────────

describe("POST /api/projects/[id]/boq", () => {
  it("creates a BOQ for a project without one", async () => {
    vi.mocked(getBoqByProject).mockResolvedValue(null);
    vi.mocked(createBoq).mockResolvedValue(fakeBoq);

    const req = buildRequest(`/api/projects/${PROJECT_ID}/boq`, {
      method: "POST",
      body: { title: "Main BOQ", currency: "USD" },
    });
    const res = await POST(req, buildParams({ id: PROJECT_ID }));
    const { status, body } = await parseResponse<Boq>(res);

    expect(status).toBe(201);
    expect(body.title).toBe("Main BOQ");
    expect(createBoq).toHaveBeenCalledWith(
      PROJECT_ID,
      expect.objectContaining({
        title: "Main BOQ",
        currency: "USD",
        createdBy: "user-test-001",
      })
    );
  });

  it("returns 409 when a BOQ already exists", async () => {
    vi.mocked(getBoqByProject).mockResolvedValue(fakeBoq);

    const req = buildRequest(`/api/projects/${PROJECT_ID}/boq`, {
      method: "POST",
      body: { title: "Second BOQ" },
    });
    const res = await POST(req, buildParams({ id: PROJECT_ID }));
    const { status } = await parseResponse(res);

    expect(status).toBe(409);
    expect(createBoq).not.toHaveBeenCalled();
  });

  it("returns 400 when title is missing", async () => {
    vi.mocked(getBoqByProject).mockResolvedValue(null);

    const req = buildRequest(`/api/projects/${PROJECT_ID}/boq`, {
      method: "POST",
      body: { currency: "USD" },
    });
    const res = await POST(req, buildParams({ id: PROJECT_ID }));
    const { status } = await parseResponse(res);

    expect(status).toBe(400);
  });

  it("returns 400 when currency is not a 3-letter code", async () => {
    vi.mocked(getBoqByProject).mockResolvedValue(null);

    const req = buildRequest(`/api/projects/${PROJECT_ID}/boq`, {
      method: "POST",
      body: { title: "X", currency: "USDOLLAR" },
    });
    const res = await POST(req, buildParams({ id: PROJECT_ID }));
    const { status } = await parseResponse(res);

    expect(status).toBe(400);
  });

  it("returns 400 when a percentage is out of bounds", async () => {
    vi.mocked(getBoqByProject).mockResolvedValue(null);

    const req = buildRequest(`/api/projects/${PROJECT_ID}/boq`, {
      method: "POST",
      body: { title: "X", vatPct: 150 },
    });
    const res = await POST(req, buildParams({ id: PROJECT_ID }));
    const { status } = await parseResponse(res);

    expect(status).toBe(400);
  });

  it("returns 403 for client role", async () => {
    setupAuth(mocks.auth, clientSession);
    vi.mocked(getOrgRole).mockResolvedValue(null as never);

    const req = buildRequest(`/api/projects/${PROJECT_ID}/boq`, {
      method: "POST",
      body: { title: "X" },
    });
    const res = await POST(req, buildParams({ id: PROJECT_ID }));
    const { status } = await parseResponse(res);

    expect(status).toBe(403);
  });

  it("returns 403 when user has no project access", async () => {
    vi.mocked(hasProjectAccess).mockResolvedValue(false);

    const req = buildRequest(`/api/projects/${PROJECT_ID}/boq`, {
      method: "POST",
      body: { title: "X" },
    });
    const res = await POST(req, buildParams({ id: PROJECT_ID }));
    const { status } = await parseResponse(res);

    expect(status).toBe(403);
  });
});

// ── PATCH /api/projects/[id]/boq ────────────────────────────────────────────

describe("PATCH /api/projects/[id]/boq", () => {
  it("updates BOQ header fields", async () => {
    vi.mocked(verifyBoqOwnership).mockResolvedValue(true);
    vi.mocked(updateBoq).mockResolvedValue({ ...fakeBoq, title: "Renamed" });

    const req = buildRequest(`/api/projects/${PROJECT_ID}/boq`, {
      method: "PATCH",
      body: { boqId: BOQ_ID, title: "Renamed" },
    });
    const res = await PATCH(req, buildParams({ id: PROJECT_ID }));
    const { status, body } = await parseResponse<Boq>(res);

    expect(status).toBe(200);
    expect(body.title).toBe("Renamed");
    expect(verifyBoqOwnership).toHaveBeenCalledWith(BOQ_ID, PROJECT_ID);
    expect(updateBoq).toHaveBeenCalledWith(
      BOQ_ID,
      expect.objectContaining({ title: "Renamed" })
    );
  });

  it("returns 400 when boqId is missing", async () => {
    const req = buildRequest(`/api/projects/${PROJECT_ID}/boq`, {
      method: "PATCH",
      body: { title: "Renamed" },
    });
    const res = await PATCH(req, buildParams({ id: PROJECT_ID }));
    const { status } = await parseResponse(res);

    expect(status).toBe(400);
  });

  it("returns 404 when BOQ is not owned by the project", async () => {
    vi.mocked(getBoqStatus).mockResolvedValue(null);

    const req = buildRequest(`/api/projects/${PROJECT_ID}/boq`, {
      method: "PATCH",
      body: { boqId: BOQ_ID, title: "X" },
    });
    const res = await PATCH(req, buildParams({ id: PROJECT_ID }));
    const { status } = await parseResponse(res);

    expect(status).toBe(404);
  });

  it("returns 400 when no fields are provided to update", async () => {
    vi.mocked(verifyBoqOwnership).mockResolvedValue(true);
    vi.mocked(updateBoq).mockResolvedValue(null);

    const req = buildRequest(`/api/projects/${PROJECT_ID}/boq`, {
      method: "PATCH",
      body: { boqId: BOQ_ID },
    });
    const res = await PATCH(req, buildParams({ id: PROJECT_ID }));
    const { status } = await parseResponse(res);

    expect(status).toBe(400);
  });

  it("returns 400 on invalid percentage", async () => {
    vi.mocked(verifyBoqOwnership).mockResolvedValue(true);

    const req = buildRequest(`/api/projects/${PROJECT_ID}/boq`, {
      method: "PATCH",
      body: { boqId: BOQ_ID, contingencyPct: -5 },
    });
    const res = await PATCH(req, buildParams({ id: PROJECT_ID }));
    const { status } = await parseResponse(res);

    expect(status).toBe(400);
  });

  it("returns 403 for client role", async () => {
    setupAuth(mocks.auth, clientSession);
    vi.mocked(getOrgRole).mockResolvedValue(null as never);

    const req = buildRequest(`/api/projects/${PROJECT_ID}/boq`, {
      method: "PATCH",
      body: { boqId: BOQ_ID, title: "X" },
    });
    const res = await PATCH(req, buildParams({ id: PROJECT_ID }));
    const { status } = await parseResponse(res);

    expect(status).toBe(403);
  });

  it("returns 423 when editing non-status fields on a locked BOQ", async () => {
    vi.mocked(getBoqStatus).mockResolvedValue("locked");

    const req = buildRequest(`/api/projects/${PROJECT_ID}/boq`, {
      method: "PATCH",
      body: { boqId: BOQ_ID, title: "Renamed" },
    });
    const res = await PATCH(req, buildParams({ id: PROJECT_ID }));
    const { status, body } = await parseResponse<{ code: string }>(res);

    expect(status).toBe(423);
    expect(body.code).toBe("BOQ_LOCKED");
    expect(updateBoq).not.toHaveBeenCalled();
  });

  it("allows the draft → submitted_to_client transition", async () => {
    vi.mocked(getBoqStatus).mockResolvedValue("draft");
    vi.mocked(updateBoq).mockResolvedValue({
      ...fakeBoq,
      status: "submitted_to_client",
    });

    const req = buildRequest(`/api/projects/${PROJECT_ID}/boq`, {
      method: "PATCH",
      body: { boqId: BOQ_ID, status: "submitted_to_client" },
    });
    const res = await PATCH(req, buildParams({ id: PROJECT_ID }));
    const { status, body } = await parseResponse<{ status: string }>(res);

    expect(status).toBe(200);
    expect(body.status).toBe("submitted_to_client");
  });

  it("rejects an invalid status transition with 422", async () => {
    vi.mocked(getBoqStatus).mockResolvedValue("draft");

    const req = buildRequest(`/api/projects/${PROJECT_ID}/boq`, {
      method: "PATCH",
      body: { boqId: BOQ_ID, status: "locked" },
    });
    const res = await PATCH(req, buildParams({ id: PROJECT_ID }));
    const { status, body } = await parseResponse<{ code: string }>(res);

    expect(status).toBe(422);
    expect(body.code).toBe("INVALID_STATUS_TRANSITION");
    expect(updateBoq).not.toHaveBeenCalled();
  });

  it("rejects any transition out of the terminal locked status", async () => {
    vi.mocked(getBoqStatus).mockResolvedValue("locked");

    const req = buildRequest(`/api/projects/${PROJECT_ID}/boq`, {
      method: "PATCH",
      body: { boqId: BOQ_ID, status: "draft" },
    });
    const res = await PATCH(req, buildParams({ id: PROJECT_ID }));
    const { status } = await parseResponse(res);

    expect(status).toBe(422);
    expect(updateBoq).not.toHaveBeenCalled();
  });
});

// ── GET /api/projects/[id]/boq/summary ──────────────────────────────────────

describe("GET /api/projects/[id]/boq/summary", () => {
  it("returns the summary", async () => {
    vi.mocked(getBoqByProject).mockResolvedValue(fakeBoq);
    // Summary mock is set up in setup.ts — override here for assertions
    const { getBoqSummary } = await import("@/lib/queries");
    vi.mocked(getBoqSummary).mockResolvedValue({
      ...fakeSummary,
      item_count: 7,
    });

    const req = buildRequest(`/api/projects/${PROJECT_ID}/boq/summary`);
    const res = await GET_SUMMARY(req, buildParams({ id: PROJECT_ID }));
    const { status, body } = await parseResponse<BoqSummary>(res);

    expect(status).toBe(200);
    expect(body.item_count).toBe(7);
    expect(getBoqSummary).toHaveBeenCalledWith(BOQ_ID);
  });

  it("returns 404 when BOQ is not found", async () => {
    vi.mocked(getBoqByProject).mockResolvedValue(null);

    const req = buildRequest(`/api/projects/${PROJECT_ID}/boq/summary`);
    const res = await GET_SUMMARY(req, buildParams({ id: PROJECT_ID }));
    const { status } = await parseResponse(res);

    expect(status).toBe(404);
  });

  it("returns 401 without session", async () => {
    setupAuth(mocks.auth, null);

    const req = buildRequest(`/api/projects/${PROJECT_ID}/boq/summary`);
    const res = await GET_SUMMARY(req, buildParams({ id: PROJECT_ID }));
    const { status } = await parseResponse(res);

    expect(status).toBe(401);
  });

  it("returns 403 without project access", async () => {
    vi.mocked(hasProjectAccess).mockResolvedValue(false);

    const req = buildRequest(`/api/projects/${PROJECT_ID}/boq/summary`);
    const res = await GET_SUMMARY(req, buildParams({ id: PROJECT_ID }));
    const { status } = await parseResponse(res);

    expect(status).toBe(403);
  });
});
