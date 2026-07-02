/**
 * Tests for GET /api/projects/[id]/boq/items/[itemId]/versions (RFQ-3a).
 *
 * Verifies the route gates on item ownership and returns the change history
 * from `getBoqItemVersions`, which feeds the Change history block on the
 * Activity tab in `BoqItemDrawer`.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  getBoqItemVersions,
  verifyBoqItemOwnership,
  hasProjectAccess,
} from "@/lib/queries";
import { GET as VERSIONS } from "@/app/api/projects/[id]/boq/items/[itemId]/versions/route";
import {
  buildRequest,
  buildParams,
  mockSession,
  setupAuth,
  parseResponse,
} from "../helpers";
import { mocks } from "../setup";
import type { BoqItemVersion } from "@/types";

const PROJECT_ID = "proj-1";
const ITEM_ID = "660e8400-e29b-41d4-a716-446655440001";

const pmSession = mockSession({ id: "user-pm" });

const version: BoqItemVersion = {
  id: "v1",
  version_number: 1,
  change_reason: "quantity",
  change_note: null,
  changed_by: "user-pm",
  changed_by_name: "Zaid",
  changed_at: "2026-06-01T00:00:00.000Z",
  changes: [{ field: "Quantity", from: 10, to: 15 }],
};

beforeEach(() => {
  vi.clearAllMocks();
  setupAuth(mocks.auth, pmSession);
  vi.mocked(hasProjectAccess).mockResolvedValue(true);
  vi.mocked(verifyBoqItemOwnership).mockResolvedValue(true);
});

describe("GET boq item versions", () => {
  it("returns the item's change history for staff", async () => {
    vi.mocked(getBoqItemVersions).mockResolvedValue([version]);

    const req = buildRequest(
      `/api/projects/${PROJECT_ID}/boq/items/${ITEM_ID}/versions`
    );
    const res = await VERSIONS(
      req,
      buildParams({ id: PROJECT_ID, itemId: ITEM_ID })
    );
    const { status, body } = await parseResponse<{
      versions: BoqItemVersion[];
    }>(res);

    expect(status).toBe(200);
    expect(body.versions).toEqual([version]);
    expect(getBoqItemVersions).toHaveBeenCalledWith(ITEM_ID);
  });

  it("404s when the item is not in this project", async () => {
    vi.mocked(verifyBoqItemOwnership).mockResolvedValue(false);

    const req = buildRequest(
      `/api/projects/${PROJECT_ID}/boq/items/${ITEM_ID}/versions`
    );
    const res = await VERSIONS(
      req,
      buildParams({ id: PROJECT_ID, itemId: ITEM_ID })
    );
    expect(res.status).toBe(404);
    expect(getBoqItemVersions).not.toHaveBeenCalled();
  });
});
