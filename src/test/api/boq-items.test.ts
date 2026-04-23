import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  createBoqItem,
  updateBoqItem,
  deleteBoqItem,
  reorderBoqItems,
  addElementToBoq,
  verifyBoqOwnership,
  verifyBoqItemOwnership,
  getBoqStatus,
  getBoqStatusForItem,
  getOrgRole,
  hasProjectAccess,
} from "@/lib/queries";
import { POST as POST_ITEM } from "@/app/api/projects/[id]/boq/items/route";
import {
  PATCH as PATCH_ITEM,
  DELETE as DELETE_ITEM,
} from "@/app/api/projects/[id]/boq/items/[itemId]/route";
import { PATCH as PATCH_REORDER } from "@/app/api/projects/[id]/boq/items/reorder/route";
import { POST as POST_FROM_ELEMENT } from "@/app/api/projects/[id]/boq/items/from-element/route";
import {
  buildRequest,
  buildParams,
  mockSession,
  setupAuth,
  parseResponse,
} from "../helpers";
import { mocks } from "../setup";
import type { BoqItemWithComputed } from "@/types";

// ── Fixtures ────────────────────────────────────────────────────────────────

const PROJECT_ID = "proj-1";
const BOQ_ID = "550e8400-e29b-41d4-a716-446655440000";
const SECTION_ID = "550e8400-e29b-41d4-a716-446655440001";
const ITEM_ID = "550e8400-e29b-41d4-a716-446655440003";
const ITEM_ID_2 = "550e8400-e29b-41d4-a716-446655440004";
const ELEMENT_ID = "550e8400-e29b-41d4-a716-446655440005";
const UPDATED_AT = "2024-01-01T00:00:00Z";

const fakeItem: BoqItemWithComputed = {
  id: ITEM_ID,
  boq_id: BOQ_ID,
  section_id: SECTION_ID,
  element_id: null,
  item_code: "BOQ-2026-001",
  description: "Laying tiles",
  unit: "m2",
  quantity: "10",
  unit_cost: "100",
  material_cost: null,
  labour_cost: null,
  overhead_pct: "0",
  margin_pct: "15",
  lifecycle_status: "draft",
  client_approval_status: "pending",
  client_approved_at: null,
  client_approved_by: null,
  requires_reapproval: false,
  element_archived: false,
  installed_qty: "0",
  has_snag: false,
  po_status: "none",
  notes: null,
  client_notes: null,
  sort_order: 0,
  is_provisional: false,
  is_excluded: false,
  created_at: UPDATED_AT,
  updated_at: UPDATED_AT,
  total_cost: "1000",
  subtotal: "1000",
  sell_price: "1150",
  progress_pct: "0",
  margin_alert: false,
};

const pmSession = mockSession();
const clientSession = mockSession({ role: "client" });

beforeEach(() => {
  vi.clearAllMocks();
  setupAuth(mocks.auth, pmSession);
  vi.mocked(hasProjectAccess).mockResolvedValue(true);
  vi.mocked(getBoqStatus).mockResolvedValue("draft");
  vi.mocked(getBoqStatusForItem).mockResolvedValue("draft");
});

// ── POST /api/projects/[id]/boq/items ───────────────────────────────────────

describe("POST /api/projects/[id]/boq/items", () => {
  it("creates an item", async () => {
    vi.mocked(verifyBoqOwnership).mockResolvedValue(true);
    vi.mocked(createBoqItem).mockResolvedValue(fakeItem);

    const req = buildRequest(`/api/projects/${PROJECT_ID}/boq/items`, {
      method: "POST",
      body: {
        boqId: BOQ_ID,
        description: "Laying tiles",
        unit: "m2",
        quantity: 10,
        unitCost: 100,
      },
    });
    const res = await POST_ITEM(req, buildParams({ id: PROJECT_ID }));
    const { status, body } = await parseResponse<BoqItemWithComputed>(res);

    expect(status).toBe(201);
    expect(body.description).toBe("Laying tiles");
    expect(createBoqItem).toHaveBeenCalledWith(
      BOQ_ID,
      "org-test-001",
      expect.objectContaining({
        description: "Laying tiles",
        unit: "m2",
        quantity: 10,
        unitCost: 100,
      })
    );
  });

  it("returns 400 when boqId is missing", async () => {
    const req = buildRequest(`/api/projects/${PROJECT_ID}/boq/items`, {
      method: "POST",
      body: { description: "x", unit: "m2" },
    });
    const res = await POST_ITEM(req, buildParams({ id: PROJECT_ID }));
    const { status } = await parseResponse(res);

    expect(status).toBe(400);
  });

  it("returns 404 when BOQ not owned by project", async () => {
    vi.mocked(getBoqStatus).mockResolvedValue(null);

    const req = buildRequest(`/api/projects/${PROJECT_ID}/boq/items`, {
      method: "POST",
      body: { boqId: BOQ_ID, description: "x", unit: "m2" },
    });
    const res = await POST_ITEM(req, buildParams({ id: PROJECT_ID }));
    const { status } = await parseResponse(res);

    expect(status).toBe(404);
  });

  it("returns 400 when description is empty", async () => {
    vi.mocked(verifyBoqOwnership).mockResolvedValue(true);

    const req = buildRequest(`/api/projects/${PROJECT_ID}/boq/items`, {
      method: "POST",
      body: { boqId: BOQ_ID, description: "", unit: "m2" },
    });
    const res = await POST_ITEM(req, buildParams({ id: PROJECT_ID }));
    const { status } = await parseResponse(res);

    expect(status).toBe(400);
  });

  it("returns 400 when quantity is negative", async () => {
    vi.mocked(verifyBoqOwnership).mockResolvedValue(true);

    const req = buildRequest(`/api/projects/${PROJECT_ID}/boq/items`, {
      method: "POST",
      body: {
        boqId: BOQ_ID,
        description: "x",
        unit: "m2",
        quantity: -5,
      },
    });
    const res = await POST_ITEM(req, buildParams({ id: PROJECT_ID }));
    const { status } = await parseResponse(res);

    expect(status).toBe(400);
  });

  it("returns 403 for client role", async () => {
    setupAuth(mocks.auth, clientSession);
    vi.mocked(getOrgRole).mockResolvedValue(null as never);

    const req = buildRequest(`/api/projects/${PROJECT_ID}/boq/items`, {
      method: "POST",
      body: { boqId: BOQ_ID, description: "x", unit: "m2" },
    });
    const res = await POST_ITEM(req, buildParams({ id: PROJECT_ID }));
    const { status } = await parseResponse(res);

    expect(status).toBe(403);
  });
});

// ── PATCH /api/projects/[id]/boq/items/[itemId] ─────────────────────────────

describe("PATCH /api/projects/[id]/boq/items/[itemId]", () => {
  it("updates item fields with a valid updatedAt token", async () => {
    vi.mocked(verifyBoqItemOwnership).mockResolvedValue(true);
    vi.mocked(updateBoqItem).mockResolvedValue({
      ok: true,
      item: { ...fakeItem, description: "Renamed" },
    });

    const req = buildRequest(
      `/api/projects/${PROJECT_ID}/boq/items/${ITEM_ID}`,
      {
        method: "PATCH",
        body: { updatedAt: UPDATED_AT, description: "Renamed" },
      }
    );
    const res = await PATCH_ITEM(
      req,
      buildParams({ id: PROJECT_ID, itemId: ITEM_ID })
    );
    const { status, body } = await parseResponse<BoqItemWithComputed>(res);

    expect(status).toBe(200);
    expect(body.description).toBe("Renamed");
    expect(updateBoqItem).toHaveBeenCalledWith(
      ITEM_ID,
      UPDATED_AT,
      expect.objectContaining({ description: "Renamed" })
    );
  });

  it("strips updatedAt from the update payload", async () => {
    vi.mocked(verifyBoqItemOwnership).mockResolvedValue(true);
    vi.mocked(updateBoqItem).mockResolvedValue({ ok: true, item: fakeItem });

    const req = buildRequest(
      `/api/projects/${PROJECT_ID}/boq/items/${ITEM_ID}`,
      {
        method: "PATCH",
        body: { updatedAt: UPDATED_AT, quantity: 20 },
      }
    );
    await PATCH_ITEM(req, buildParams({ id: PROJECT_ID, itemId: ITEM_ID }));

    const call = vi.mocked(updateBoqItem).mock.calls[0];
    const fields = call[2];
    expect(fields).not.toHaveProperty("updatedAt");
    expect(fields.quantity).toBe(20);
  });

  it("returns 409 on optimistic lock conflict", async () => {
    vi.mocked(verifyBoqItemOwnership).mockResolvedValue(true);
    vi.mocked(updateBoqItem).mockResolvedValue({
      ok: false,
      reason: "conflict",
    });

    const req = buildRequest(
      `/api/projects/${PROJECT_ID}/boq/items/${ITEM_ID}`,
      {
        method: "PATCH",
        body: { updatedAt: UPDATED_AT, quantity: 5 },
      }
    );
    const res = await PATCH_ITEM(
      req,
      buildParams({ id: PROJECT_ID, itemId: ITEM_ID })
    );
    const { status, body } = await parseResponse<{
      code: string;
      error: string;
    }>(res);

    expect(status).toBe(409);
    expect(body.code).toBe("OPTIMISTIC_LOCK_CONFLICT");
    expect(body.error).toMatch(/updated/i);
  });

  it("returns 404 when the row doesn't exist", async () => {
    vi.mocked(verifyBoqItemOwnership).mockResolvedValue(true);
    vi.mocked(updateBoqItem).mockResolvedValue({
      ok: false,
      reason: "not_found",
    });

    const req = buildRequest(
      `/api/projects/${PROJECT_ID}/boq/items/${ITEM_ID}`,
      {
        method: "PATCH",
        body: { updatedAt: UPDATED_AT, quantity: 5 },
      }
    );
    const res = await PATCH_ITEM(
      req,
      buildParams({ id: PROJECT_ID, itemId: ITEM_ID })
    );
    const { status } = await parseResponse(res);

    expect(status).toBe(404);
  });

  it("returns 404 when item is not owned by project", async () => {
    vi.mocked(getBoqStatusForItem).mockResolvedValue(null);

    const req = buildRequest(
      `/api/projects/${PROJECT_ID}/boq/items/${ITEM_ID}`,
      {
        method: "PATCH",
        body: { updatedAt: UPDATED_AT, quantity: 5 },
      }
    );
    const res = await PATCH_ITEM(
      req,
      buildParams({ id: PROJECT_ID, itemId: ITEM_ID })
    );
    const { status } = await parseResponse(res);

    expect(status).toBe(404);
    expect(updateBoqItem).not.toHaveBeenCalled();
  });

  it("returns 400 when updatedAt token is missing", async () => {
    vi.mocked(verifyBoqItemOwnership).mockResolvedValue(true);

    const req = buildRequest(
      `/api/projects/${PROJECT_ID}/boq/items/${ITEM_ID}`,
      { method: "PATCH", body: { quantity: 5 } }
    );
    const res = await PATCH_ITEM(
      req,
      buildParams({ id: PROJECT_ID, itemId: ITEM_ID })
    );
    const { status } = await parseResponse(res);

    expect(status).toBe(400);
  });

  it("returns 400 on invalid lifecycleStatus", async () => {
    vi.mocked(verifyBoqItemOwnership).mockResolvedValue(true);

    const req = buildRequest(
      `/api/projects/${PROJECT_ID}/boq/items/${ITEM_ID}`,
      {
        method: "PATCH",
        body: { updatedAt: UPDATED_AT, lifecycleStatus: "nonsense" },
      }
    );
    const res = await PATCH_ITEM(
      req,
      buildParams({ id: PROJECT_ID, itemId: ITEM_ID })
    );
    const { status } = await parseResponse(res);

    expect(status).toBe(400);
  });

  it("returns 403 for client role", async () => {
    setupAuth(mocks.auth, clientSession);
    vi.mocked(getOrgRole).mockResolvedValue(null as never);

    const req = buildRequest(
      `/api/projects/${PROJECT_ID}/boq/items/${ITEM_ID}`,
      {
        method: "PATCH",
        body: { updatedAt: UPDATED_AT, quantity: 5 },
      }
    );
    const res = await PATCH_ITEM(
      req,
      buildParams({ id: PROJECT_ID, itemId: ITEM_ID })
    );
    const { status } = await parseResponse(res);

    expect(status).toBe(403);
  });
});

// ── DELETE /api/projects/[id]/boq/items/[itemId] ────────────────────────────

describe("DELETE /api/projects/[id]/boq/items/[itemId]", () => {
  it("deletes with a valid updatedAt token", async () => {
    vi.mocked(verifyBoqItemOwnership).mockResolvedValue(true);
    vi.mocked(deleteBoqItem).mockResolvedValue({ ok: true });

    const req = buildRequest(
      `/api/projects/${PROJECT_ID}/boq/items/${ITEM_ID}`,
      { method: "DELETE", body: { updatedAt: UPDATED_AT } }
    );
    const res = await DELETE_ITEM(
      req,
      buildParams({ id: PROJECT_ID, itemId: ITEM_ID })
    );
    const { status, body } = await parseResponse<{ ok: boolean }>(res);

    expect(status).toBe(200);
    expect(body.ok).toBe(true);
    expect(deleteBoqItem).toHaveBeenCalledWith(ITEM_ID, UPDATED_AT);
  });

  it("returns 409 on optimistic lock conflict", async () => {
    vi.mocked(verifyBoqItemOwnership).mockResolvedValue(true);
    vi.mocked(deleteBoqItem).mockResolvedValue({
      ok: false,
      reason: "conflict",
    });

    const req = buildRequest(
      `/api/projects/${PROJECT_ID}/boq/items/${ITEM_ID}`,
      { method: "DELETE", body: { updatedAt: UPDATED_AT } }
    );
    const res = await DELETE_ITEM(
      req,
      buildParams({ id: PROJECT_ID, itemId: ITEM_ID })
    );
    const { status, body } = await parseResponse<{ code: string }>(res);

    expect(status).toBe(409);
    expect(body.code).toBe("OPTIMISTIC_LOCK_CONFLICT");
  });

  it("returns 404 when the row doesn't exist", async () => {
    vi.mocked(verifyBoqItemOwnership).mockResolvedValue(true);
    vi.mocked(deleteBoqItem).mockResolvedValue({
      ok: false,
      reason: "not_found",
    });

    const req = buildRequest(
      `/api/projects/${PROJECT_ID}/boq/items/${ITEM_ID}`,
      { method: "DELETE", body: { updatedAt: UPDATED_AT } }
    );
    const res = await DELETE_ITEM(
      req,
      buildParams({ id: PROJECT_ID, itemId: ITEM_ID })
    );
    const { status } = await parseResponse(res);

    expect(status).toBe(404);
  });

  it("returns 404 when item is not owned by project", async () => {
    vi.mocked(getBoqStatusForItem).mockResolvedValue(null);

    const req = buildRequest(
      `/api/projects/${PROJECT_ID}/boq/items/${ITEM_ID}`,
      { method: "DELETE", body: { updatedAt: UPDATED_AT } }
    );
    const res = await DELETE_ITEM(
      req,
      buildParams({ id: PROJECT_ID, itemId: ITEM_ID })
    );
    const { status } = await parseResponse(res);

    expect(status).toBe(404);
    expect(deleteBoqItem).not.toHaveBeenCalled();
  });

  it("returns 400 when updatedAt is missing", async () => {
    vi.mocked(verifyBoqItemOwnership).mockResolvedValue(true);

    const req = buildRequest(
      `/api/projects/${PROJECT_ID}/boq/items/${ITEM_ID}`,
      { method: "DELETE", body: {} }
    );
    const res = await DELETE_ITEM(
      req,
      buildParams({ id: PROJECT_ID, itemId: ITEM_ID })
    );
    const { status } = await parseResponse(res);

    expect(status).toBe(400);
  });

  it("returns 423 when the parent BOQ is locked", async () => {
    vi.mocked(getBoqStatusForItem).mockResolvedValue("locked");

    const req = buildRequest(
      `/api/projects/${PROJECT_ID}/boq/items/${ITEM_ID}`,
      { method: "DELETE", body: { updatedAt: UPDATED_AT } }
    );
    const res = await DELETE_ITEM(
      req,
      buildParams({ id: PROJECT_ID, itemId: ITEM_ID })
    );
    const { status, body } = await parseResponse<{ code: string }>(res);

    expect(status).toBe(423);
    expect(body.code).toBe("BOQ_LOCKED");
    expect(deleteBoqItem).not.toHaveBeenCalled();
  });

  it("returns 423 when PATCHing an item on a superseded BOQ", async () => {
    vi.mocked(getBoqStatusForItem).mockResolvedValue("superseded");

    const req = buildRequest(
      `/api/projects/${PROJECT_ID}/boq/items/${ITEM_ID}`,
      {
        method: "PATCH",
        body: { updatedAt: UPDATED_AT, description: "hacked" },
      }
    );
    const res = await PATCH_ITEM(
      req,
      buildParams({ id: PROJECT_ID, itemId: ITEM_ID })
    );
    const { status } = await parseResponse(res);

    expect(status).toBe(423);
    expect(updateBoqItem).not.toHaveBeenCalled();
  });

  it("returns 403 for client role", async () => {
    setupAuth(mocks.auth, clientSession);
    vi.mocked(getOrgRole).mockResolvedValue(null as never);

    const req = buildRequest(
      `/api/projects/${PROJECT_ID}/boq/items/${ITEM_ID}`,
      { method: "DELETE", body: { updatedAt: UPDATED_AT } }
    );
    const res = await DELETE_ITEM(
      req,
      buildParams({ id: PROJECT_ID, itemId: ITEM_ID })
    );
    const { status } = await parseResponse(res);

    expect(status).toBe(403);
  });
});

// ── PATCH /api/projects/[id]/boq/items/reorder ──────────────────────────────

describe("PATCH /api/projects/[id]/boq/items/reorder", () => {
  it("reorders items within a section", async () => {
    vi.mocked(verifyBoqOwnership).mockResolvedValue(true);

    const req = buildRequest(`/api/projects/${PROJECT_ID}/boq/items/reorder`, {
      method: "PATCH",
      body: {
        boqId: BOQ_ID,
        sectionId: SECTION_ID,
        orderedIds: [ITEM_ID_2, ITEM_ID],
      },
    });
    const res = await PATCH_REORDER(req, buildParams({ id: PROJECT_ID }));
    const { status, body } = await parseResponse<{ ok: boolean }>(res);

    expect(status).toBe(200);
    expect(body.ok).toBe(true);
    expect(reorderBoqItems).toHaveBeenCalledWith(BOQ_ID, SECTION_ID, [
      ITEM_ID_2,
      ITEM_ID,
    ]);
  });

  it("reorders items at the BOQ root (null sectionId)", async () => {
    vi.mocked(verifyBoqOwnership).mockResolvedValue(true);

    const req = buildRequest(`/api/projects/${PROJECT_ID}/boq/items/reorder`, {
      method: "PATCH",
      body: {
        boqId: BOQ_ID,
        sectionId: null,
        orderedIds: [ITEM_ID],
      },
    });
    const res = await PATCH_REORDER(req, buildParams({ id: PROJECT_ID }));
    const { status } = await parseResponse(res);

    expect(status).toBe(200);
    expect(reorderBoqItems).toHaveBeenCalledWith(BOQ_ID, null, [ITEM_ID]);
  });

  it("returns 400 when boqId is missing", async () => {
    const req = buildRequest(`/api/projects/${PROJECT_ID}/boq/items/reorder`, {
      method: "PATCH",
      body: { sectionId: SECTION_ID, orderedIds: [ITEM_ID] },
    });
    const res = await PATCH_REORDER(req, buildParams({ id: PROJECT_ID }));
    const { status } = await parseResponse(res);

    expect(status).toBe(400);
  });

  it("returns 404 when BOQ not owned by project", async () => {
    vi.mocked(getBoqStatus).mockResolvedValue(null);

    const req = buildRequest(`/api/projects/${PROJECT_ID}/boq/items/reorder`, {
      method: "PATCH",
      body: {
        boqId: BOQ_ID,
        sectionId: SECTION_ID,
        orderedIds: [ITEM_ID],
      },
    });
    const res = await PATCH_REORDER(req, buildParams({ id: PROJECT_ID }));
    const { status } = await parseResponse(res);

    expect(status).toBe(404);
  });

  it("returns 400 when sectionId is not a uuid", async () => {
    vi.mocked(verifyBoqOwnership).mockResolvedValue(true);

    const req = buildRequest(`/api/projects/${PROJECT_ID}/boq/items/reorder`, {
      method: "PATCH",
      body: {
        boqId: BOQ_ID,
        sectionId: "not-uuid",
        orderedIds: [ITEM_ID],
      },
    });
    const res = await PATCH_REORDER(req, buildParams({ id: PROJECT_ID }));
    const { status } = await parseResponse(res);

    expect(status).toBe(400);
  });

  it("returns 403 for client role", async () => {
    setupAuth(mocks.auth, clientSession);
    vi.mocked(getOrgRole).mockResolvedValue(null as never);

    const req = buildRequest(`/api/projects/${PROJECT_ID}/boq/items/reorder`, {
      method: "PATCH",
      body: {
        boqId: BOQ_ID,
        sectionId: SECTION_ID,
        orderedIds: [ITEM_ID],
      },
    });
    const res = await PATCH_REORDER(req, buildParams({ id: PROJECT_ID }));
    const { status } = await parseResponse(res);

    expect(status).toBe(403);
  });
});

// ── POST /api/projects/[id]/boq/items/from-element ──────────────────────────

describe("POST /api/projects/[id]/boq/items/from-element", () => {
  it("adds an element library entry as a BOQ item", async () => {
    vi.mocked(verifyBoqOwnership).mockResolvedValue(true);
    vi.mocked(addElementToBoq).mockResolvedValue(fakeItem);

    const req = buildRequest(
      `/api/projects/${PROJECT_ID}/boq/items/from-element`,
      {
        method: "POST",
        body: {
          boqId: BOQ_ID,
          sectionId: SECTION_ID,
          elementId: ELEMENT_ID,
          quantity: 5,
        },
      }
    );
    const res = await POST_FROM_ELEMENT(req, buildParams({ id: PROJECT_ID }));
    const { status, body } = await parseResponse<BoqItemWithComputed>(res);

    expect(status).toBe(201);
    expect(body.id).toBe(ITEM_ID);
    expect(addElementToBoq).toHaveBeenCalledWith(BOQ_ID, "org-test-001", {
      sectionId: SECTION_ID,
      elementId: ELEMENT_ID,
      quantity: 5,
    });
  });

  it("defaults quantity to 1 when omitted", async () => {
    vi.mocked(verifyBoqOwnership).mockResolvedValue(true);
    vi.mocked(addElementToBoq).mockResolvedValue(fakeItem);

    const req = buildRequest(
      `/api/projects/${PROJECT_ID}/boq/items/from-element`,
      {
        method: "POST",
        body: {
          boqId: BOQ_ID,
          sectionId: null,
          elementId: ELEMENT_ID,
        },
      }
    );
    await POST_FROM_ELEMENT(req, buildParams({ id: PROJECT_ID }));

    expect(addElementToBoq).toHaveBeenCalledWith(
      BOQ_ID,
      "org-test-001",
      expect.objectContaining({ quantity: 1 })
    );
  });

  it("returns 404 when element is not found", async () => {
    vi.mocked(verifyBoqOwnership).mockResolvedValue(true);
    vi.mocked(addElementToBoq).mockResolvedValue(null);

    const req = buildRequest(
      `/api/projects/${PROJECT_ID}/boq/items/from-element`,
      {
        method: "POST",
        body: {
          boqId: BOQ_ID,
          sectionId: null,
          elementId: ELEMENT_ID,
        },
      }
    );
    const res = await POST_FROM_ELEMENT(req, buildParams({ id: PROJECT_ID }));
    const { status } = await parseResponse(res);

    expect(status).toBe(404);
  });

  it("returns 400 when elementId is missing", async () => {
    vi.mocked(verifyBoqOwnership).mockResolvedValue(true);

    const req = buildRequest(
      `/api/projects/${PROJECT_ID}/boq/items/from-element`,
      { method: "POST", body: { boqId: BOQ_ID, sectionId: null } }
    );
    const res = await POST_FROM_ELEMENT(req, buildParams({ id: PROJECT_ID }));
    const { status } = await parseResponse(res);

    expect(status).toBe(400);
  });

  it("returns 400 when boqId is missing", async () => {
    const req = buildRequest(
      `/api/projects/${PROJECT_ID}/boq/items/from-element`,
      {
        method: "POST",
        body: { sectionId: null, elementId: ELEMENT_ID },
      }
    );
    const res = await POST_FROM_ELEMENT(req, buildParams({ id: PROJECT_ID }));
    const { status } = await parseResponse(res);

    expect(status).toBe(400);
  });

  it("returns 404 when BOQ not owned by project", async () => {
    vi.mocked(getBoqStatus).mockResolvedValue(null);

    const req = buildRequest(
      `/api/projects/${PROJECT_ID}/boq/items/from-element`,
      {
        method: "POST",
        body: {
          boqId: BOQ_ID,
          sectionId: null,
          elementId: ELEMENT_ID,
        },
      }
    );
    const res = await POST_FROM_ELEMENT(req, buildParams({ id: PROJECT_ID }));
    const { status } = await parseResponse(res);

    expect(status).toBe(404);
  });

  it("returns 403 for client role", async () => {
    setupAuth(mocks.auth, clientSession);
    vi.mocked(getOrgRole).mockResolvedValue(null as never);

    const req = buildRequest(
      `/api/projects/${PROJECT_ID}/boq/items/from-element`,
      {
        method: "POST",
        body: {
          boqId: BOQ_ID,
          sectionId: null,
          elementId: ELEMENT_ID,
        },
      }
    );
    const res = await POST_FROM_ELEMENT(req, buildParams({ id: PROJECT_ID }));
    const { status } = await parseResponse(res);

    expect(status).toBe(403);
  });
});
