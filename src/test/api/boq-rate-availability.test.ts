/**
 * POST /api/projects/[id]/boq/rate-availability — pm/architect (PR C).
 * Batch "which of these elements have an active matching rate contract".
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  getBestRateForElements,
  getOrgRole,
  hasProjectAccess,
} from "@/lib/queries";
import { POST } from "@/app/api/projects/[id]/boq/rate-availability/route";
import {
  buildRequest,
  buildParams,
  mockSession,
  setupAuth,
  parseResponse,
} from "../helpers";
import { mocks } from "../setup";

const PROJECT_ID = "proj-1";
const EL1 = "550e8400-e29b-41d4-a716-446655440001";
const EL2 = "550e8400-e29b-41d4-a716-446655440002";

const pmSession = mockSession();
const architectSession = mockSession({ role: "architect" });
const clientSession = mockSession({ role: "client" });
const vendorSession = mockSession({ role: "vendor", email: "v@test.com" });

const url = `/api/projects/${PROJECT_ID}/boq/rate-availability`;
const post = (body: unknown, session = pmSession) => {
  setupAuth(mocks.auth, session);
  return POST(
    buildRequest(url, { method: "POST", body }),
    buildParams({ id: PROJECT_ID })
  );
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(hasProjectAccess).mockResolvedValue(true);
  vi.mocked(getBestRateForElements).mockResolvedValue({});
});

describe("POST .../boq/rate-availability", () => {
  it("returns the best rate per element, keyed by element id", async () => {
    vi.mocked(getBestRateForElements).mockResolvedValue({
      [EL1]: {
        rate_contract_item_id: "rci-1",
        vendor_name: "Acme",
        rate: 50,
        currency: "USD",
        unit: "m²",
      } as never,
      [EL2]: null,
    });
    const res = await post({ elementIds: [EL1, EL2] });
    expect(res.status).toBe(200);
    const { body } = await parseResponse<{
      availability: Record<string, { vendor_name: string } | null>;
    }>(res);
    expect(body.availability[EL1]?.vendor_name).toBe("Acme");
    expect(body.availability[EL2]).toBeNull();
    expect(vi.mocked(getBestRateForElements)).toHaveBeenCalledWith(
      expect.any(String),
      [EL1, EL2]
    );
  });

  it("400 on an empty elementIds array", async () => {
    expect((await post({ elementIds: [] })).status).toBe(400);
    expect(vi.mocked(getBestRateForElements)).not.toHaveBeenCalled();
  });

  it("400 on a non-uuid element id", async () => {
    expect((await post({ elementIds: ["not-a-uuid"] })).status).toBe(400);
  });

  it("architect can query", async () => {
    expect((await post({ elementIds: [EL1] }, architectSession)).status).toBe(
      200
    );
  });

  it("blocks client and vendor", async () => {
    vi.mocked(getOrgRole).mockResolvedValue(null as never);
    expect((await post({ elementIds: [EL1] }, clientSession)).status).toBe(403);
    expect((await post({ elementIds: [EL1] }, vendorSession)).status).toBe(403);
  });
});
