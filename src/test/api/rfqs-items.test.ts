/**
 * POST /api/projects/[id]/rfqs/[rfqId]/items — append items to a draft RFQ.
 * DELETE /api/projects/[id]/rfqs/[rfqId]/items/[itemId] — remove one item.
 *
 * Both are draft-only on the server side. The route layer maps the query's
 * reason codes to HTTP status (404 not-found, 409 wrong-status, 400 bad
 * payload).
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  addRfqItems,
  hasProjectAccess,
  removeRfqItem,
  updateRfqItemAttachments,
  verifyRfqOwnership,
} from "@/lib/queries";
import { POST as POST_ITEMS } from "@/app/api/projects/[id]/rfqs/[rfqId]/items/route";
import {
  DELETE as DELETE_ITEM,
  PATCH as PATCH_ITEM,
} from "@/app/api/projects/[id]/rfqs/[rfqId]/items/[itemId]/route";
import {
  buildRequest,
  buildParams,
  mockSession,
  setupAuth,
  parseResponse,
} from "../helpers";
import { mocks } from "../setup";

const PROJECT_ID = "11111111-1111-4111-8111-111111111111";
const RFQ_ID = "22222222-2222-4222-8222-222222222222";
const ITEM_ID = "33333333-3333-4333-8333-333333333333";
const BOQ_ITEM_ID = "44444444-4444-4444-8444-444444444444";

const pmSession = mockSession();
const clientSession = mockSession({ role: "client" });
const vendorSession = mockSession({ role: "vendor", email: "vendor@test.com" });

const validItemsBody = {
  items: [
    {
      boqItemId: BOQ_ITEM_ID,
      description: "Copper pipe",
      unit: "m",
      quantity: 25,
    },
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
  setupAuth(mocks.auth, pmSession);
  vi.mocked(hasProjectAccess).mockResolvedValue(true);
  vi.mocked(verifyRfqOwnership).mockResolvedValue(true);
  vi.mocked(addRfqItems).mockResolvedValue({ ok: true, count: 1 });
  vi.mocked(removeRfqItem).mockResolvedValue({ ok: true });
});

// ── POST .../items ─────────────────────────────────────────────────────────

describe("POST /api/projects/[id]/rfqs/[rfqId]/items", () => {
  it("appends items to a draft RFQ", async () => {
    const res = await POST_ITEMS(
      buildRequest(`/api/projects/${PROJECT_ID}/rfqs/${RFQ_ID}/items`, {
        method: "POST",
        body: validItemsBody,
      }),
      buildParams({ id: PROJECT_ID, rfqId: RFQ_ID })
    );
    const { status, body } = await parseResponse<{ count: number }>(res);
    expect(status).toBe(200);
    expect(body.count).toBe(1);
  });

  it("400 when items array is empty", async () => {
    const res = await POST_ITEMS(
      buildRequest(`/api/projects/${PROJECT_ID}/rfqs/${RFQ_ID}/items`, {
        method: "POST",
        body: { items: [] },
      }),
      buildParams({ id: PROJECT_ID, rfqId: RFQ_ID })
    );
    expect(res.status).toBe(400);
  });

  it("400 when payload is malformed", async () => {
    const res = await POST_ITEMS(
      buildRequest(`/api/projects/${PROJECT_ID}/rfqs/${RFQ_ID}/items`, {
        method: "POST",
        body: { items: [{ boqItemId: BOQ_ITEM_ID }] },
      }),
      buildParams({ id: PROJECT_ID, rfqId: RFQ_ID })
    );
    expect(res.status).toBe(400);
  });

  it("409 when RFQ is no longer in draft", async () => {
    vi.mocked(addRfqItems).mockResolvedValue({
      ok: false,
      reason: "wrong_status",
    });
    const res = await POST_ITEMS(
      buildRequest(`/api/projects/${PROJECT_ID}/rfqs/${RFQ_ID}/items`, {
        method: "POST",
        body: validItemsBody,
      }),
      buildParams({ id: PROJECT_ID, rfqId: RFQ_ID })
    );
    expect(res.status).toBe(409);
  });

  it("404 when the RFQ disappeared", async () => {
    vi.mocked(addRfqItems).mockResolvedValue({
      ok: false,
      reason: "not_found",
    });
    const res = await POST_ITEMS(
      buildRequest(`/api/projects/${PROJECT_ID}/rfqs/${RFQ_ID}/items`, {
        method: "POST",
        body: validItemsBody,
      }),
      buildParams({ id: PROJECT_ID, rfqId: RFQ_ID })
    );
    expect(res.status).toBe(404);
  });

  it("400 when a BOQ item doesn't belong to this project", async () => {
    vi.mocked(addRfqItems).mockResolvedValue({
      ok: false,
      reason: "bad_items",
    });
    const res = await POST_ITEMS(
      buildRequest(`/api/projects/${PROJECT_ID}/rfqs/${RFQ_ID}/items`, {
        method: "POST",
        body: validItemsBody,
      }),
      buildParams({ id: PROJECT_ID, rfqId: RFQ_ID })
    );
    expect(res.status).toBe(400);
  });

  it("404 on cross-project rfqId", async () => {
    vi.mocked(verifyRfqOwnership).mockResolvedValue(false);
    const res = await POST_ITEMS(
      buildRequest(`/api/projects/${PROJECT_ID}/rfqs/${RFQ_ID}/items`, {
        method: "POST",
        body: validItemsBody,
      }),
      buildParams({ id: PROJECT_ID, rfqId: RFQ_ID })
    );
    expect(res.status).toBe(404);
  });

  it("blocks client", async () => {
    setupAuth(mocks.auth, clientSession);
    const res = await POST_ITEMS(
      buildRequest(`/api/projects/${PROJECT_ID}/rfqs/${RFQ_ID}/items`, {
        method: "POST",
        body: validItemsBody,
      }),
      buildParams({ id: PROJECT_ID, rfqId: RFQ_ID })
    );
    expect(res.status).toBe(403);
  });

  it("blocks vendor", async () => {
    setupAuth(mocks.auth, vendorSession);
    const res = await POST_ITEMS(
      buildRequest(`/api/projects/${PROJECT_ID}/rfqs/${RFQ_ID}/items`, {
        method: "POST",
        body: validItemsBody,
      }),
      buildParams({ id: PROJECT_ID, rfqId: RFQ_ID })
    );
    expect(res.status).toBe(403);
  });
});

// ── DELETE .../items/[itemId] ──────────────────────────────────────────────

describe("DELETE /api/projects/[id]/rfqs/[rfqId]/items/[itemId]", () => {
  it("removes one item from a draft RFQ", async () => {
    const res = await DELETE_ITEM(
      buildRequest(
        `/api/projects/${PROJECT_ID}/rfqs/${RFQ_ID}/items/${ITEM_ID}`,
        { method: "DELETE" }
      ),
      buildParams({ id: PROJECT_ID, rfqId: RFQ_ID, itemId: ITEM_ID })
    );
    const { status, body } = await parseResponse<{ ok: true }>(res);
    expect(status).toBe(200);
    expect(body.ok).toBe(true);
  });

  it("calls removeRfqItem with the right ids", async () => {
    await DELETE_ITEM(
      buildRequest(
        `/api/projects/${PROJECT_ID}/rfqs/${RFQ_ID}/items/${ITEM_ID}`,
        { method: "DELETE" }
      ),
      buildParams({ id: PROJECT_ID, rfqId: RFQ_ID, itemId: ITEM_ID })
    );
    expect(vi.mocked(removeRfqItem)).toHaveBeenCalledWith(RFQ_ID, ITEM_ID);
  });

  it("404 when item not found", async () => {
    vi.mocked(removeRfqItem).mockResolvedValue({
      ok: false,
      reason: "not_found",
    });
    const res = await DELETE_ITEM(
      buildRequest(
        `/api/projects/${PROJECT_ID}/rfqs/${RFQ_ID}/items/${ITEM_ID}`,
        { method: "DELETE" }
      ),
      buildParams({ id: PROJECT_ID, rfqId: RFQ_ID, itemId: ITEM_ID })
    );
    expect(res.status).toBe(404);
  });

  it("409 when RFQ is no longer in draft", async () => {
    vi.mocked(removeRfqItem).mockResolvedValue({
      ok: false,
      reason: "wrong_status",
    });
    const res = await DELETE_ITEM(
      buildRequest(
        `/api/projects/${PROJECT_ID}/rfqs/${RFQ_ID}/items/${ITEM_ID}`,
        { method: "DELETE" }
      ),
      buildParams({ id: PROJECT_ID, rfqId: RFQ_ID, itemId: ITEM_ID })
    );
    expect(res.status).toBe(409);
  });

  it("404 on cross-project rfqId", async () => {
    vi.mocked(verifyRfqOwnership).mockResolvedValue(false);
    const res = await DELETE_ITEM(
      buildRequest(
        `/api/projects/${PROJECT_ID}/rfqs/${RFQ_ID}/items/${ITEM_ID}`,
        { method: "DELETE" }
      ),
      buildParams({ id: PROJECT_ID, rfqId: RFQ_ID, itemId: ITEM_ID })
    );
    expect(res.status).toBe(404);
  });

  it("400 when itemId is missing from params", async () => {
    const res = await DELETE_ITEM(
      buildRequest(
        `/api/projects/${PROJECT_ID}/rfqs/${RFQ_ID}/items/${ITEM_ID}`,
        { method: "DELETE" }
      ),
      buildParams({ id: PROJECT_ID, rfqId: RFQ_ID })
    );
    expect(res.status).toBe(400);
  });

  it("blocks client", async () => {
    setupAuth(mocks.auth, clientSession);
    const res = await DELETE_ITEM(
      buildRequest(
        `/api/projects/${PROJECT_ID}/rfqs/${RFQ_ID}/items/${ITEM_ID}`,
        { method: "DELETE" }
      ),
      buildParams({ id: PROJECT_ID, rfqId: RFQ_ID, itemId: ITEM_ID })
    );
    expect(res.status).toBe(403);
  });
});

describe("PATCH /api/projects/[id]/rfqs/[rfqId]/items/[itemId] — attachments (§11)", () => {
  const body = {
    attachments: [
      { url: "https://x.test/spec.pdf", fileName: "spec.pdf" },
    ],
  };

  it("PM replaces the line's attachments", async () => {
    vi.mocked(updateRfqItemAttachments).mockResolvedValue({ ok: true });
    const res = await PATCH_ITEM(
      buildRequest(
        `/api/projects/${PROJECT_ID}/rfqs/${RFQ_ID}/items/${ITEM_ID}`,
        { method: "PATCH", body }
      ),
      buildParams({ id: PROJECT_ID, rfqId: RFQ_ID, itemId: ITEM_ID })
    );
    expect(res.status).toBe(200);
    expect(updateRfqItemAttachments).toHaveBeenCalledWith(
      RFQ_ID,
      ITEM_ID,
      body.attachments
    );
  });

  it("400 on an invalid attachment url", async () => {
    const res = await PATCH_ITEM(
      buildRequest(
        `/api/projects/${PROJECT_ID}/rfqs/${RFQ_ID}/items/${ITEM_ID}`,
        { method: "PATCH", body: { attachments: [{ url: "nope", fileName: "x" }] } }
      ),
      buildParams({ id: PROJECT_ID, rfqId: RFQ_ID, itemId: ITEM_ID })
    );
    expect(res.status).toBe(400);
  });

  it("409 when the RFQ is terminal (wrong_status)", async () => {
    vi.mocked(updateRfqItemAttachments).mockResolvedValue({
      ok: false,
      reason: "wrong_status",
    });
    const res = await PATCH_ITEM(
      buildRequest(
        `/api/projects/${PROJECT_ID}/rfqs/${RFQ_ID}/items/${ITEM_ID}`,
        { method: "PATCH", body }
      ),
      buildParams({ id: PROJECT_ID, rfqId: RFQ_ID, itemId: ITEM_ID })
    );
    expect(res.status).toBe(409);
  });

  it("404 when the item is gone", async () => {
    vi.mocked(updateRfqItemAttachments).mockResolvedValue({
      ok: false,
      reason: "not_found",
    });
    const res = await PATCH_ITEM(
      buildRequest(
        `/api/projects/${PROJECT_ID}/rfqs/${RFQ_ID}/items/${ITEM_ID}`,
        { method: "PATCH", body }
      ),
      buildParams({ id: PROJECT_ID, rfqId: RFQ_ID, itemId: ITEM_ID })
    );
    expect(res.status).toBe(404);
  });

  it("blocks vendor", async () => {
    setupAuth(mocks.auth, vendorSession);
    const res = await PATCH_ITEM(
      buildRequest(
        `/api/projects/${PROJECT_ID}/rfqs/${RFQ_ID}/items/${ITEM_ID}`,
        { method: "PATCH", body }
      ),
      buildParams({ id: PROJECT_ID, rfqId: RFQ_ID, itemId: ITEM_ID })
    );
    expect(res.status).toBe(403);
  });
});
