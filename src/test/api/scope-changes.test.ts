import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  createScopeChange,
  listScopeChanges,
  getScopeChangeById,
  updateScopeChange,
  transitionScopeChange,
  implementScopeChange,
  logAuditSafe,
  AUDIT_ACTIONS,
} from "@/lib/queries";
import { GET as LIST, POST as CREATE } from "@/app/api/scope-changes/route";
import { GET as DETAIL, PATCH } from "@/app/api/scope-changes/[id]/route";
import { POST as TRANSITION } from "@/app/api/scope-changes/[id]/transition/route";
import { POST as IMPLEMENT } from "@/app/api/scope-changes/[id]/implement/route";
import {
  buildRequest,
  buildParams,
  mockSession,
  setupAuth,
  parseResponse,
} from "../helpers";
import { mocks } from "../setup";
import type { ScopeChange } from "@/types";

const SC_ID = "55555555-5555-4555-8555-555555555555";
const BOQ_ITEM_ID = "11111111-1111-4111-8111-111111111111";

const fakeScopeChange: ScopeChange = {
  id: SC_ID,
  org_id: "org-test-001",
  project_id: "22222222-2222-4222-8222-222222222222",
  boq_item_id: BOQ_ITEM_ID,
  sc_number: "SC-2026-001",
  change_reason: "quantity",
  description: null,
  impact: "update_rfq",
  status: "requested",
  requested_by: "user-test-001",
  submitted_at: null,
  reviewed_by: null,
  reviewed_at: null,
  review_note: null,
  client_decision_by: null,
  client_decided_at: null,
  client_decision_note: null,
  boq_item_version_id: null,
  rfq_id: null,
  created_at: "2026-07-08T00:00:00Z",
  updated_at: "2026-07-08T00:00:00Z",
};

const pmSession = mockSession();
const clientSession = mockSession({ role: "client", email: "client@test.com" });

beforeEach(() => {
  vi.clearAllMocks();
  setupAuth(mocks.auth, pmSession);
});

// ── POST /api/scope-changes ────────────────────────────────────────────────

describe("POST /api/scope-changes", () => {
  const body = { boqItemId: BOQ_ITEM_ID, changeReason: "quantity" };

  it("creates a scope change and audits it", async () => {
    vi.mocked(createScopeChange).mockResolvedValue({
      ok: true,
      row: fakeScopeChange,
    });
    const res = await CREATE(
      buildRequest("/api/scope-changes", { method: "POST", body })
    );
    const { status, body: resBody } = await parseResponse<ScopeChange>(res);
    expect(status).toBe(201);
    expect(resBody.id).toBe(SC_ID);
    expect(logAuditSafe).toHaveBeenCalledWith(
      expect.objectContaining({
        action: AUDIT_ACTIONS.SCOPE_CHANGE_CREATED,
        targetTable: "scope_change",
        targetId: SC_ID,
      })
    );
  });

  it("returns 404 when the BOQ item isn't found in the org", async () => {
    vi.mocked(createScopeChange).mockResolvedValue({
      ok: false,
      reason: "boq_item_not_found",
    });
    const res = await CREATE(
      buildRequest("/api/scope-changes", { method: "POST", body })
    );
    expect(res.status).toBe(404);
  });

  it("rejects an unknown change reason", async () => {
    const res = await CREATE(
      buildRequest("/api/scope-changes", {
        method: "POST",
        body: { boqItemId: BOQ_ITEM_ID, changeReason: "other" },
      })
    );
    expect(res.status).toBe(400);
  });

  it("rejects the client role", async () => {
    setupAuth(mocks.auth, clientSession);
    const res = await CREATE(
      buildRequest("/api/scope-changes", { method: "POST", body })
    );
    expect(res.status).toBe(403);
  });
});

// ── GET /api/scope-changes ─────────────────────────────────────────────────

describe("GET /api/scope-changes", () => {
  it("returns the list", async () => {
    vi.mocked(listScopeChanges).mockResolvedValue({
      rows: [{ ...fakeScopeChange, boq_item_name: "Worktop" } as never],
      total: 1,
    });
    const res = await LIST(buildRequest("/api/scope-changes"));
    const { status, body } = await parseResponse<{ total: number }>(res);
    expect(status).toBe(200);
    expect(body.total).toBe(1);
  });
});

// ── GET /api/scope-changes/[id] ────────────────────────────────────────────

describe("GET /api/scope-changes/[id]", () => {
  it("returns the row", async () => {
    vi.mocked(getScopeChangeById).mockResolvedValue({
      ...fakeScopeChange,
      boq_item_name: "Worktop",
      boq_item_code: "B-1",
      project_name: "Villa",
      requested_by_name: "PM",
    });
    const res = await DETAIL(
      buildRequest(`/api/scope-changes/${SC_ID}`),
      buildParams({ id: SC_ID })
    );
    expect(res.status).toBe(200);
  });

  it("returns 404 when missing", async () => {
    vi.mocked(getScopeChangeById).mockResolvedValue(null);
    const res = await DETAIL(
      buildRequest(`/api/scope-changes/${SC_ID}`),
      buildParams({ id: SC_ID })
    );
    expect(res.status).toBe(404);
  });
});

// ── PATCH /api/scope-changes/[id] ──────────────────────────────────────────

describe("PATCH /api/scope-changes/[id]", () => {
  it("updates and audits the changed columns", async () => {
    vi.mocked(updateScopeChange).mockResolvedValue({
      ok: true,
      row: fakeScopeChange,
      changedColumns: ["impact"],
    });
    const res = await PATCH(
      buildRequest(`/api/scope-changes/${SC_ID}`, {
        method: "PATCH",
        body: { impact: "requote" },
      }),
      buildParams({ id: SC_ID })
    );
    expect(res.status).toBe(200);
    expect(logAuditSafe).toHaveBeenCalledWith(
      expect.objectContaining({
        action: AUDIT_ACTIONS.SCOPE_CHANGE_UPDATED,
        metadata: { fields: ["impact"] },
      })
    );
  });

  it("does not audit a no-op PATCH", async () => {
    vi.mocked(updateScopeChange).mockResolvedValue({
      ok: true,
      row: fakeScopeChange,
      changedColumns: [],
    });
    const res = await PATCH(
      buildRequest(`/api/scope-changes/${SC_ID}`, {
        method: "PATCH",
        body: {},
      }),
      buildParams({ id: SC_ID })
    );
    expect(res.status).toBe(200);
    expect(logAuditSafe).not.toHaveBeenCalled();
  });

  it("returns 409 when not in 'requested'", async () => {
    vi.mocked(updateScopeChange).mockResolvedValue({
      ok: false,
      reason: "not_editable",
    });
    const res = await PATCH(
      buildRequest(`/api/scope-changes/${SC_ID}`, {
        method: "PATCH",
        body: { impact: "requote" },
      }),
      buildParams({ id: SC_ID })
    );
    expect(res.status).toBe(409);
  });
});

// ── POST /api/scope-changes/[id]/transition ────────────────────────────────

describe("POST /api/scope-changes/[id]/transition", () => {
  it("submits and audits", async () => {
    vi.mocked(transitionScopeChange).mockResolvedValue({
      ok: true,
      row: { ...fakeScopeChange, status: "under_review" },
    });
    const res = await TRANSITION(
      buildRequest(`/api/scope-changes/${SC_ID}/transition`, {
        method: "POST",
        body: { action: "submit" },
      }),
      buildParams({ id: SC_ID })
    );
    expect(res.status).toBe(200);
    expect(logAuditSafe).toHaveBeenCalledWith(
      expect.objectContaining({
        action: AUDIT_ACTIONS.SCOPE_CHANGE_TRANSITIONED,
      })
    );
  });

  it("maps forbidden → 403", async () => {
    vi.mocked(transitionScopeChange).mockResolvedValue({
      ok: false,
      reason: "forbidden",
    });
    const res = await TRANSITION(
      buildRequest(`/api/scope-changes/${SC_ID}/transition`, {
        method: "POST",
        body: { action: "approve" },
      }),
      buildParams({ id: SC_ID })
    );
    expect(res.status).toBe(403);
  });

  it("maps invalid_status_transition → 409", async () => {
    vi.mocked(transitionScopeChange).mockResolvedValue({
      ok: false,
      reason: "invalid_status_transition",
    });
    const res = await TRANSITION(
      buildRequest(`/api/scope-changes/${SC_ID}/transition`, {
        method: "POST",
        body: { action: "send_to_client" },
      }),
      buildParams({ id: SC_ID })
    );
    expect(res.status).toBe(409);
  });
});

// ── POST /api/scope-changes/[id]/implement ─────────────────────────────────

describe("POST /api/scope-changes/[id]/implement", () => {
  it("implements an approved change and audits", async () => {
    vi.mocked(implementScopeChange).mockResolvedValue({
      ok: true,
      row: { ...fakeScopeChange, status: "implemented" },
    });
    const res = await IMPLEMENT(
      buildRequest(`/api/scope-changes/${SC_ID}/implement`, { method: "POST" }),
      buildParams({ id: SC_ID })
    );
    expect(res.status).toBe(200);
    expect(logAuditSafe).toHaveBeenCalledWith(
      expect.objectContaining({
        action: AUDIT_ACTIONS.SCOPE_CHANGE_IMPLEMENTED,
      })
    );
  });

  it("maps a non-approved change → 409", async () => {
    vi.mocked(implementScopeChange).mockResolvedValue({
      ok: false,
      reason: "invalid_status_transition",
    });
    const res = await IMPLEMENT(
      buildRequest(`/api/scope-changes/${SC_ID}/implement`, { method: "POST" }),
      buildParams({ id: SC_ID })
    );
    expect(res.status).toBe(409);
  });
});
