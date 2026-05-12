import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  moveBoqItem,
  getBoqStatusForItem,
  getOrgRole,
  hasProjectAccess,
} from "@/lib/queries";
import { POST as POST_MOVE } from "@/app/api/projects/[id]/boq/items/[itemId]/move/route";
import {
  buildRequest,
  buildParams,
  mockSession,
  setupAuth,
  parseResponse,
} from "../helpers";
import { mocks } from "../setup";
import type { BoqItemWithComputed } from "@/types";

const PROJECT_ID = "proj-1";
const BOQ_ID = "550e8400-e29b-41d4-a716-446655440000";
const TARGET_SECTION_ID = "550e8400-e29b-41d4-a716-446655440002";
const ITEM_ID = "550e8400-e29b-41d4-a716-446655440003";
const UPDATED_AT = "2024-01-01T00:00:00Z";

const fakeMovedItem: BoqItemWithComputed = {
  id: ITEM_ID,
  boq_id: BOQ_ID,
  section_id: TARGET_SECTION_ID,
  element_id: null,
  item_code: "BOQ-2026-001",
  description: "Laying tiles",
  unit: "m2",
  quantity: "10",
  unit_cost: "100",
  material_cost: null,
  labour_cost: null,
  overhead_pct: "0",
  service_charge_pct: "0",
  margin_pct: "15",
  source: "custom",
  rate_contract_item_id: null,
  spec_reference: null,
  notes: null,
  status: "draft",
  client_approval_status: "pending",
  requires_reapproval: false,
  client_rate: null,
  budget_rate: null,
  client_approved_at: null,
  client_approved_by: null,
  changes_requested_at: null,
  changes_requested_by: null,
  changes_requested_comment: null,
  client_pin_message: null,
  client_pin_required_action: null,
  client_pin_required_by: null,
  po_status: null,
  po_id: null,
  is_provisional: false,
  is_excluded: false,
  visible_to_client: true,
  length: null,
  breadth: null,
  height: null,
  sort_order: 0,
  created_at: "2024-01-01T00:00:00Z",
  updated_at: "2024-01-01T00:00:01Z",
  created_by: null,
  amount: "1000",
  cost_total: "1000",
  sell_price: "1150",
  subtotal: "11500",
  progress_pct: "0",
  margin_alert: false,
};

const pmSession = mockSession();
const clientSession = mockSession({ role: "client" });

beforeEach(() => {
  vi.clearAllMocks();
  setupAuth(mocks.auth, pmSession);
  vi.mocked(hasProjectAccess).mockResolvedValue(true);
  vi.mocked(getBoqStatusForItem).mockResolvedValue("draft");
});

describe("POST /api/projects/[id]/boq/items/[itemId]/move", () => {
  it("moves an item to a target section", async () => {
    vi.mocked(moveBoqItem).mockResolvedValue({ ok: true, item: fakeMovedItem });

    const req = buildRequest(
      `/api/projects/${PROJECT_ID}/boq/items/${ITEM_ID}/move`,
      {
        method: "POST",
        body: { updatedAt: UPDATED_AT, targetSectionId: TARGET_SECTION_ID },
      }
    );
    const res = await POST_MOVE(
      req,
      buildParams({ id: PROJECT_ID, itemId: ITEM_ID })
    );
    const { status, body } = await parseResponse<BoqItemWithComputed>(res);

    expect(status).toBe(200);
    expect(body.section_id).toBe(TARGET_SECTION_ID);
    expect(moveBoqItem).toHaveBeenCalledWith(
      ITEM_ID,
      TARGET_SECTION_ID,
      UPDATED_AT
    );
  });

  it("accepts null targetSectionId (move to Unassigned)", async () => {
    vi.mocked(moveBoqItem).mockResolvedValue({
      ok: true,
      item: { ...fakeMovedItem, section_id: null },
    });

    const req = buildRequest(
      `/api/projects/${PROJECT_ID}/boq/items/${ITEM_ID}/move`,
      {
        method: "POST",
        body: { updatedAt: UPDATED_AT, targetSectionId: null },
      }
    );
    const res = await POST_MOVE(
      req,
      buildParams({ id: PROJECT_ID, itemId: ITEM_ID })
    );
    const { status } = await parseResponse(res);

    expect(status).toBe(200);
    expect(moveBoqItem).toHaveBeenCalledWith(ITEM_ID, null, UPDATED_AT);
  });

  it("returns 400 (WRONG_BOQ) when target section is in a different BOQ", async () => {
    vi.mocked(moveBoqItem).mockResolvedValue({
      ok: false,
      reason: "wrong_boq",
    });

    const req = buildRequest(
      `/api/projects/${PROJECT_ID}/boq/items/${ITEM_ID}/move`,
      {
        method: "POST",
        body: { updatedAt: UPDATED_AT, targetSectionId: TARGET_SECTION_ID },
      }
    );
    const res = await POST_MOVE(
      req,
      buildParams({ id: PROJECT_ID, itemId: ITEM_ID })
    );
    const { status, body } = await parseResponse<{ code: string }>(res);

    expect(status).toBe(400);
    expect(body.code).toBe("WRONG_BOQ");
  });

  it("returns 409 on optimistic-lock conflict", async () => {
    vi.mocked(moveBoqItem).mockResolvedValue({ ok: false, reason: "conflict" });

    const req = buildRequest(
      `/api/projects/${PROJECT_ID}/boq/items/${ITEM_ID}/move`,
      {
        method: "POST",
        body: { updatedAt: UPDATED_AT, targetSectionId: TARGET_SECTION_ID },
      }
    );
    const res = await POST_MOVE(
      req,
      buildParams({ id: PROJECT_ID, itemId: ITEM_ID })
    );
    const { status, body } = await parseResponse<{ code: string }>(res);

    expect(status).toBe(409);
    expect(body.code).toBe("OPTIMISTIC_LOCK_CONFLICT");
  });

  it("returns 404 when the item doesn't exist", async () => {
    vi.mocked(moveBoqItem).mockResolvedValue({
      ok: false,
      reason: "not_found",
    });

    const req = buildRequest(
      `/api/projects/${PROJECT_ID}/boq/items/${ITEM_ID}/move`,
      {
        method: "POST",
        body: { updatedAt: UPDATED_AT, targetSectionId: TARGET_SECTION_ID },
      }
    );
    const res = await POST_MOVE(
      req,
      buildParams({ id: PROJECT_ID, itemId: ITEM_ID })
    );
    const { status } = await parseResponse(res);

    expect(status).toBe(404);
  });

  it("returns 404 when item is not owned by project", async () => {
    vi.mocked(getBoqStatusForItem).mockResolvedValue(null);

    const req = buildRequest(
      `/api/projects/${PROJECT_ID}/boq/items/${ITEM_ID}/move`,
      {
        method: "POST",
        body: { updatedAt: UPDATED_AT, targetSectionId: TARGET_SECTION_ID },
      }
    );
    const res = await POST_MOVE(
      req,
      buildParams({ id: PROJECT_ID, itemId: ITEM_ID })
    );
    const { status } = await parseResponse(res);

    expect(status).toBe(404);
    expect(moveBoqItem).not.toHaveBeenCalled();
  });

  it("returns 423 when the parent BOQ is locked", async () => {
    vi.mocked(getBoqStatusForItem).mockResolvedValue("locked");

    const req = buildRequest(
      `/api/projects/${PROJECT_ID}/boq/items/${ITEM_ID}/move`,
      {
        method: "POST",
        body: { updatedAt: UPDATED_AT, targetSectionId: TARGET_SECTION_ID },
      }
    );
    const res = await POST_MOVE(
      req,
      buildParams({ id: PROJECT_ID, itemId: ITEM_ID })
    );
    const { status, body } = await parseResponse<{ code: string }>(res);

    expect(status).toBe(423);
    expect(body.code).toBe("BOQ_LOCKED");
    expect(moveBoqItem).not.toHaveBeenCalled();
  });

  it("returns 400 when updatedAt is missing", async () => {
    const req = buildRequest(
      `/api/projects/${PROJECT_ID}/boq/items/${ITEM_ID}/move`,
      { method: "POST", body: { targetSectionId: TARGET_SECTION_ID } }
    );
    const res = await POST_MOVE(
      req,
      buildParams({ id: PROJECT_ID, itemId: ITEM_ID })
    );
    const { status } = await parseResponse(res);

    expect(status).toBe(400);
    expect(moveBoqItem).not.toHaveBeenCalled();
  });

  it("returns 400 when targetSectionId is not a uuid or null", async () => {
    const req = buildRequest(
      `/api/projects/${PROJECT_ID}/boq/items/${ITEM_ID}/move`,
      {
        method: "POST",
        body: { updatedAt: UPDATED_AT, targetSectionId: "not-a-uuid" },
      }
    );
    const res = await POST_MOVE(
      req,
      buildParams({ id: PROJECT_ID, itemId: ITEM_ID })
    );
    const { status } = await parseResponse(res);

    expect(status).toBe(400);
    expect(moveBoqItem).not.toHaveBeenCalled();
  });

  it("returns 403 for client role", async () => {
    setupAuth(mocks.auth, clientSession);
    vi.mocked(getOrgRole).mockResolvedValue(null as never);

    const req = buildRequest(
      `/api/projects/${PROJECT_ID}/boq/items/${ITEM_ID}/move`,
      {
        method: "POST",
        body: { updatedAt: UPDATED_AT, targetSectionId: TARGET_SECTION_ID },
      }
    );
    const res = await POST_MOVE(
      req,
      buildParams({ id: PROJECT_ID, itemId: ITEM_ID })
    );
    const { status } = await parseResponse(res);

    expect(status).toBe(403);
    expect(moveBoqItem).not.toHaveBeenCalled();
  });
});
