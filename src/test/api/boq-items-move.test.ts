import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  moveBoqItem,
  verifyBoqItemOwnership,
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

const fakeMovedItem = {
  id: ITEM_ID,
  boq_id: BOQ_ID,
  section_id: TARGET_SECTION_ID,
  phase: "draft",
  sort_order: 0,
  updated_at: "2024-01-01T00:00:01Z",
} as unknown as BoqItemWithComputed;

const pmSession = mockSession();
const clientSession = mockSession({ role: "client" });

beforeEach(() => {
  vi.clearAllMocks();
  setupAuth(mocks.auth, pmSession);
  vi.mocked(hasProjectAccess).mockResolvedValue(true);
  vi.mocked(verifyBoqItemOwnership).mockResolvedValue(true);
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
    const { status, body } = await parseResponse<{ section_id: string }>(res);

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
    expect(res.status).toBe(200);
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
    expect(res.status).toBe(409);
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
    expect(res.status).toBe(404);
  });

  it("returns 404 when item is not owned by project", async () => {
    vi.mocked(verifyBoqItemOwnership).mockResolvedValue(false);

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
    expect(res.status).toBe(404);
    expect(moveBoqItem).not.toHaveBeenCalled();
  });

  it("returns 400 when updatedAt is missing", async () => {
    const req = buildRequest(
      `/api/projects/${PROJECT_ID}/boq/items/${ITEM_ID}/move`,
      {
        method: "POST",
        body: { targetSectionId: TARGET_SECTION_ID },
      }
    );
    const res = await POST_MOVE(
      req,
      buildParams({ id: PROJECT_ID, itemId: ITEM_ID })
    );
    expect(res.status).toBe(400);
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
    expect(res.status).toBe(400);
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
    expect(res.status).toBe(403);
  });
});
