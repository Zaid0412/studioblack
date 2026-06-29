import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  applyRateContractToBoqItem,
  verifyBoqItemOwnership,
  getOrgRole,
  hasProjectAccess,
} from "@/lib/queries";
import { POST as APPLY_RATE } from "@/app/api/projects/[id]/boq/items/[itemId]/apply-rate/route";
import { buildRequest, buildParams, mockSession, setupAuth } from "../helpers";
import { mocks } from "../setup";
import type { BoqItemWithComputed } from "@/types";

const PROJECT_ID = "proj-1";
const ITEM_ID = "550e8400-e29b-41d4-a716-446655440003";
const RCI_ID = "550e8400-e29b-41d4-a716-446655440009";
const UPDATED_AT = "2024-01-01T00:00:00Z";

const fakeItem = {
  id: ITEM_ID,
  source: "rate_contract",
  unit_cost: 450,
  updated_at: "2024-01-01T00:00:01Z",
} as unknown as BoqItemWithComputed;

const pmSession = mockSession();
const clientSession = mockSession({ role: "client" });

const body = { rateContractItemId: RCI_ID, updatedAt: UPDATED_AT };
const url = `/api/projects/${PROJECT_ID}/boq/items/${ITEM_ID}/apply-rate`;
const call = () =>
  APPLY_RATE(
    buildRequest(url, { method: "POST", body }),
    buildParams({ id: PROJECT_ID, itemId: ITEM_ID })
  );

beforeEach(() => {
  vi.clearAllMocks();
  setupAuth(mocks.auth, pmSession);
  vi.mocked(hasProjectAccess).mockResolvedValue(true);
  vi.mocked(verifyBoqItemOwnership).mockResolvedValue(true);
});

describe("POST /api/projects/[id]/boq/items/[itemId]/apply-rate", () => {
  it("applies a covering rate", async () => {
    vi.mocked(applyRateContractToBoqItem).mockResolvedValue({
      ok: true,
      item: fakeItem,
    });
    const res = await call();
    expect(res.status).toBe(200);
    expect(applyRateContractToBoqItem).toHaveBeenCalledWith(
      expect.any(String),
      ITEM_ID,
      RCI_ID,
      UPDATED_AT
    );
  });

  it("returns 400 when the item has no element", async () => {
    vi.mocked(applyRateContractToBoqItem).mockResolvedValue({
      ok: false,
      reason: "no_element",
    });
    expect((await call()).status).toBe(400);
  });

  it("returns 400 when the rate doesn't cover the item", async () => {
    vi.mocked(applyRateContractToBoqItem).mockResolvedValue({
      ok: false,
      reason: "rate_not_applicable",
    });
    expect((await call()).status).toBe(400);
  });

  it("returns 409 on optimistic-lock conflict", async () => {
    vi.mocked(applyRateContractToBoqItem).mockResolvedValue({
      ok: false,
      reason: "conflict",
    });
    expect((await call()).status).toBe(409);
  });

  it("returns 404 when the item is missing", async () => {
    vi.mocked(applyRateContractToBoqItem).mockResolvedValue({
      ok: false,
      reason: "not_found",
    });
    expect((await call()).status).toBe(404);
  });

  it("returns 404 when the item is not owned by the project", async () => {
    vi.mocked(verifyBoqItemOwnership).mockResolvedValue(false);
    expect((await call()).status).toBe(404);
    expect(applyRateContractToBoqItem).not.toHaveBeenCalled();
  });

  it("returns 400 when rateContractItemId is missing", async () => {
    const res = await APPLY_RATE(
      buildRequest(url, { method: "POST", body: { updatedAt: UPDATED_AT } }),
      buildParams({ id: PROJECT_ID, itemId: ITEM_ID })
    );
    expect(res.status).toBe(400);
  });

  it("returns 403 for client role", async () => {
    setupAuth(mocks.auth, clientSession);
    vi.mocked(getOrgRole).mockResolvedValue(null as never);
    expect((await call()).status).toBe(403);
  });
});
