import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "@/app/api/projects/[id]/boq/import/confirm/route";
import {
  bulkInsertBoqItems,
  verifyBoqOwnership,
  withBoqImportIdempotency,
} from "@/lib/queries";
import {
  BASE_URL,
  buildParams,
  mockSession,
  parseResponse,
  setupAuth,
} from "../helpers";
import { mocks } from "../setup";

const PROJECT_ID = "11111111-1111-4111-8111-111111111111";
const BOQ_ID = "22222222-2222-4222-8222-222222222222";

function buildRequest(body: unknown) {
  return new NextRequest(
    new URL(`/api/projects/${PROJECT_ID}/boq/import/confirm`, BASE_URL),
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: BASE_URL,
        host: "localhost:3000",
      },
      body: JSON.stringify(body),
    }
  );
}

const pmSession = mockSession();
const clientSession = mockSession({ role: "client" });

const goodRow = {
  rowNumber: 1,
  // Resolved by the parser (from a Category Path, or inherited from the row's
  // linked element) — required by the time it reaches confirm.
  categoryId: "44444444-4444-4444-8444-444444444444",
  description: "Slab 100mm",
  unit: "m2",
  quantity: 50,
  unitCost: 45,
};

/**
 * Build a fresh payload with a unique description per test. The confirm route
 * has a module-level memory LRU keyed on the canonicalized body hash — tests
 * that reuse the same body would collide and read each other's cached result.
 */
function uniquePayload(tag: string, extra: Partial<typeof goodRow> = {}) {
  return {
    boqId: BOQ_ID,
    strategy: "append" as const,
    rows: [{ ...goodRow, description: `Slab 100mm - ${tag}`, ...extra }],
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  setupAuth(mocks.auth, pmSession);
  vi.mocked(verifyBoqOwnership).mockResolvedValue(true);
  vi.mocked(bulkInsertBoqItems).mockResolvedValue({
    inserted: 1,
    replaced: 0,
    createdSections: [],
    failed: [],
  });
  // Pass-through — unit tests don't care about replay.
  vi.mocked(withBoqImportIdempotency).mockImplementation(async (_key, run) => ({
    result: await run(),
    replayed: false,
  }));
});

describe("POST /api/projects/[id]/boq/import/confirm", () => {
  it("inserts valid rows and returns import counts", async () => {
    const res = await POST(
      buildRequest(uniquePayload("valid")),
      buildParams({ id: PROJECT_ID })
    );
    const { status, body } = await parseResponse<{
      inserted: number;
      replaced: number;
    }>(res);

    expect(status).toBe(200);
    expect(body.inserted).toBe(1);
    expect(bulkInsertBoqItems).toHaveBeenCalledWith(
      BOQ_ID,
      "org-test-001",
      "append",
      expect.arrayContaining([
        expect.objectContaining({ description: "Slab 100mm - valid" }),
      ])
    );
  });

  it("rejects a payload whose boqId doesn't belong to the project", async () => {
    vi.mocked(verifyBoqOwnership).mockResolvedValue(false);
    const res = await POST(
      buildRequest(uniquePayload("not-owned")),
      buildParams({ id: PROJECT_ID })
    );
    expect(res.status).toBe(404);
    expect(bulkInsertBoqItems).not.toHaveBeenCalled();
  });

  it("denies client role with 403", async () => {
    setupAuth(mocks.auth, clientSession);
    const res = await POST(
      buildRequest(uniquePayload("client")),
      buildParams({ id: PROJECT_ID })
    );
    expect(res.status).toBe(403);
  });

  it("returns 400 when the row schema fails validation", async () => {
    const badRow = { ...goodRow, unit: "not-a-unit" };
    const res = await POST(
      buildRequest({ boqId: BOQ_ID, strategy: "append", rows: [badRow] }),
      buildParams({ id: PROJECT_ID })
    );
    expect(res.status).toBe(400);
    expect(bulkInsertBoqItems).not.toHaveBeenCalled();
  });

  it("rejects rows > 5000 at the schema layer", async () => {
    const rows = Array.from({ length: 5001 }, (_, i) => ({
      ...goodRow,
      rowNumber: i + 1,
      description: `oversize-${i}`,
    }));
    const res = await POST(
      buildRequest({ boqId: BOQ_ID, strategy: "append", rows }),
      buildParams({ id: PROJECT_ID })
    );
    expect(res.status).toBe(400);
    expect(bulkInsertBoqItems).not.toHaveBeenCalled();
  });

  it("propagates per-row failures from the query layer", async () => {
    vi.mocked(bulkInsertBoqItems).mockResolvedValue({
      inserted: 0,
      replaced: 0,
      createdSections: [],
      failed: [{ rowNumber: 1, error: "duplicate code" }],
    });
    const res = await POST(
      buildRequest(uniquePayload("row-failures")),
      buildParams({ id: PROJECT_ID })
    );
    const { status, body } = await parseResponse<{
      failed: Array<{ rowNumber: number }>;
    }>(res);
    expect(status).toBe(200);
    expect(body.failed).toHaveLength(1);
  });

  it("returns cached result on replay (X-Idempotent-Replay header set)", async () => {
    vi.mocked(withBoqImportIdempotency).mockResolvedValueOnce({
      result: {
        inserted: 3,
        replaced: 0,
        createdSections: [],
        failed: [],
      },
      replayed: true,
    });
    const res = await POST(
      buildRequest(uniquePayload("replay")),
      buildParams({ id: PROJECT_ID })
    );
    expect(res.headers.get("X-Idempotent-Replay")).toBe("true");
  });

  it("replaces via the replace strategy", async () => {
    vi.mocked(bulkInsertBoqItems).mockResolvedValue({
      inserted: 2,
      replaced: 5,
      createdSections: [],
      failed: [],
    });
    const res = await POST(
      buildRequest({
        boqId: BOQ_ID,
        strategy: "replace",
        rows: [
          { ...goodRow, description: "replace-test-row-1" },
          { ...goodRow, rowNumber: 2, description: "replace-test-row-2" },
        ],
      }),
      buildParams({ id: PROJECT_ID })
    );
    const { status, body } = await parseResponse<{ replaced: number }>(res);
    expect(status).toBe(200);
    expect(body.replaced).toBe(5);
    expect(bulkInsertBoqItems).toHaveBeenCalledWith(
      BOQ_ID,
      "org-test-001",
      "replace",
      expect.any(Array)
    );
  });
});
