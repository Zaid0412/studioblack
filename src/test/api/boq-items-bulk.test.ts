import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  moveBoqItemsBulk,
  deleteBoqItemsBulk,
  getOrgRole,
  hasProjectAccess,
  verifyBoqOwnership,
} from "@/lib/queries";
import { POST as POST_BULK_MOVE } from "@/app/api/projects/[id]/boq/items/bulk-move/route";
import { POST as POST_BULK_DELETE } from "@/app/api/projects/[id]/boq/items/bulk-delete/route";
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
const ITEM_ID_1 = "550e8400-e29b-41d4-a716-446655440003";
const ITEM_ID_2 = "550e8400-e29b-41d4-a716-446655440004";

const fakeItem = (id: string, sectionId: string | null): BoqItemWithComputed =>
  ({
    id,
    boq_id: BOQ_ID,
    section_id: sectionId,
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
  }) as BoqItemWithComputed;

const pmSession = mockSession();
const clientSession = mockSession({ role: "client" });

beforeEach(() => {
  vi.clearAllMocks();
  setupAuth(mocks.auth, pmSession);
  vi.mocked(hasProjectAccess).mockResolvedValue(true);
  vi.mocked(verifyBoqOwnership).mockResolvedValue(true);
});

describe("POST /api/projects/[id]/boq/items/bulk-move", () => {
  it("moves all items to the target section", async () => {
    const movedItems = [
      fakeItem(ITEM_ID_1, TARGET_SECTION_ID),
      fakeItem(ITEM_ID_2, TARGET_SECTION_ID),
    ];
    vi.mocked(moveBoqItemsBulk).mockResolvedValue({
      ok: true,
      items: movedItems,
    });

    const req = buildRequest(
      `/api/projects/${PROJECT_ID}/boq/items/bulk-move`,
      {
        method: "POST",
        body: {
          boqId: BOQ_ID,
          itemIds: [ITEM_ID_1, ITEM_ID_2],
          targetSectionId: TARGET_SECTION_ID,
        },
      }
    );
    const res = await POST_BULK_MOVE(req, buildParams({ id: PROJECT_ID }));
    const { status, body } = await parseResponse<{
      items: BoqItemWithComputed[];
    }>(res);

    expect(status).toBe(200);
    expect(body.items).toHaveLength(2);
    expect(moveBoqItemsBulk).toHaveBeenCalledWith(
      [ITEM_ID_1, ITEM_ID_2],
      BOQ_ID,
      TARGET_SECTION_ID
    );
  });

  it("accepts null targetSectionId (move to Unassigned)", async () => {
    vi.mocked(moveBoqItemsBulk).mockResolvedValue({ ok: true, items: [] });

    const req = buildRequest(
      `/api/projects/${PROJECT_ID}/boq/items/bulk-move`,
      {
        method: "POST",
        body: {
          boqId: BOQ_ID,
          itemIds: [ITEM_ID_1],
          targetSectionId: null,
        },
      }
    );
    const res = await POST_BULK_MOVE(req, buildParams({ id: PROJECT_ID }));
    const { status } = await parseResponse(res);

    expect(status).toBe(200);
    expect(moveBoqItemsBulk).toHaveBeenCalledWith([ITEM_ID_1], BOQ_ID, null);
  });

  it("returns 400 (WRONG_BOQ) when target section is in a different BOQ", async () => {
    vi.mocked(moveBoqItemsBulk).mockResolvedValue({
      ok: false,
      reason: "wrong_boq",
    });

    const req = buildRequest(
      `/api/projects/${PROJECT_ID}/boq/items/bulk-move`,
      {
        method: "POST",
        body: {
          boqId: BOQ_ID,
          itemIds: [ITEM_ID_1],
          targetSectionId: TARGET_SECTION_ID,
        },
      }
    );
    const res = await POST_BULK_MOVE(req, buildParams({ id: PROJECT_ID }));
    const { status, body } = await parseResponse<{ code: string }>(res);

    expect(status).toBe(400);
    expect(body.code).toBe("WRONG_BOQ");
  });

  it("returns 404 when any item is missing", async () => {
    vi.mocked(moveBoqItemsBulk).mockResolvedValue({
      ok: false,
      reason: "not_found",
    });

    const req = buildRequest(
      `/api/projects/${PROJECT_ID}/boq/items/bulk-move`,
      {
        method: "POST",
        body: {
          boqId: BOQ_ID,
          itemIds: [ITEM_ID_1, ITEM_ID_2],
          targetSectionId: TARGET_SECTION_ID,
        },
      }
    );
    const res = await POST_BULK_MOVE(req, buildParams({ id: PROJECT_ID }));
    const { status } = await parseResponse(res);

    expect(status).toBe(404);
  });

  it("returns 400 when itemIds is empty", async () => {
    const req = buildRequest(
      `/api/projects/${PROJECT_ID}/boq/items/bulk-move`,
      {
        method: "POST",
        body: {
          boqId: BOQ_ID,
          itemIds: [],
          targetSectionId: TARGET_SECTION_ID,
        },
      }
    );
    const res = await POST_BULK_MOVE(req, buildParams({ id: PROJECT_ID }));
    const { status } = await parseResponse(res);

    expect(status).toBe(400);
    expect(moveBoqItemsBulk).not.toHaveBeenCalled();
  });

  it("returns 403 for client role", async () => {
    setupAuth(mocks.auth, clientSession);
    vi.mocked(getOrgRole).mockResolvedValue(null as never);

    const req = buildRequest(
      `/api/projects/${PROJECT_ID}/boq/items/bulk-move`,
      {
        method: "POST",
        body: {
          boqId: BOQ_ID,
          itemIds: [ITEM_ID_1],
          targetSectionId: TARGET_SECTION_ID,
        },
      }
    );
    const res = await POST_BULK_MOVE(req, buildParams({ id: PROJECT_ID }));
    expect(res.status).toBe(403);
    expect(moveBoqItemsBulk).not.toHaveBeenCalled();
  });
});

describe("POST /api/projects/[id]/boq/items/bulk-delete", () => {
  it("deletes the supplied items", async () => {
    vi.mocked(deleteBoqItemsBulk).mockResolvedValue(2);

    const req = buildRequest(
      `/api/projects/${PROJECT_ID}/boq/items/bulk-delete`,
      {
        method: "POST",
        body: { boqId: BOQ_ID, itemIds: [ITEM_ID_1, ITEM_ID_2] },
      }
    );
    const res = await POST_BULK_DELETE(req, buildParams({ id: PROJECT_ID }));
    const { status, body } = await parseResponse<{ deletedCount: number }>(res);

    expect(status).toBe(200);
    expect(body.deletedCount).toBe(2);
    expect(deleteBoqItemsBulk).toHaveBeenCalledWith(
      [ITEM_ID_1, ITEM_ID_2],
      BOQ_ID
    );
  });

  it("returns 400 when itemIds is empty", async () => {
    const req = buildRequest(
      `/api/projects/${PROJECT_ID}/boq/items/bulk-delete`,
      { method: "POST", body: { boqId: BOQ_ID, itemIds: [] } }
    );
    const res = await POST_BULK_DELETE(req, buildParams({ id: PROJECT_ID }));
    const { status } = await parseResponse(res);

    expect(status).toBe(400);
    expect(deleteBoqItemsBulk).not.toHaveBeenCalled();
  });

  it("returns 403 for client role", async () => {
    setupAuth(mocks.auth, clientSession);
    vi.mocked(getOrgRole).mockResolvedValue(null as never);

    const req = buildRequest(
      `/api/projects/${PROJECT_ID}/boq/items/bulk-delete`,
      { method: "POST", body: { boqId: BOQ_ID, itemIds: [ITEM_ID_1] } }
    );
    const res = await POST_BULK_DELETE(req, buildParams({ id: PROJECT_ID }));
    expect(res.status).toBe(403);
    expect(deleteBoqItemsBulk).not.toHaveBeenCalled();
  });
});
