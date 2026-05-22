/**
 * GET /api/projects/[id]/rfqs — paginated list with filters.
 *
 * Pins:
 *   - PM/architect read; client + vendor blocked at withAuth boundary.
 *   - Query params validated via Zod (status, search, page, limit).
 *   - Pagination echoed back in response.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { getRfqsByProject, hasProjectAccess } from "@/lib/queries";
import { GET as GET_LIST } from "@/app/api/projects/[id]/rfqs/route";
import {
  buildRequest,
  buildParams,
  mockSession,
  setupAuth,
  parseResponse,
} from "../helpers";
import { mocks } from "../setup";
import type { RfqListRow } from "@/types";

const PROJECT_ID = "11111111-1111-4111-8111-111111111111";

const pmSession = mockSession();
const architectSession = mockSession({ role: "architect" });
const clientSession = mockSession({ role: "client" });
const vendorSession = mockSession({ role: "vendor" });

const sampleRow: RfqListRow = {
  id: "22222222-2222-4222-8222-222222222222",
  rfq_number: "RFQ-2026-001",
  title: "Plumbing scope",
  status: "draft",
  issued_date: null,
  response_deadline: null,
  item_count: 5,
  vendor_count: 0,
  created_at: "2026-05-14T00:00:00Z",
  latest_quote_submitted_at: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  setupAuth(mocks.auth, pmSession);
  vi.mocked(hasProjectAccess).mockResolvedValue(true);
  vi.mocked(getRfqsByProject).mockResolvedValue({
    rows: [sampleRow],
    total: 1,
  });
});

describe("GET /api/projects/[id]/rfqs", () => {
  it("returns rows + total + pagination for PM", async () => {
    const res = await GET_LIST(
      buildRequest(`/api/projects/${PROJECT_ID}/rfqs`),
      buildParams({ id: PROJECT_ID })
    );
    const { status, body } = await parseResponse<{
      rows: RfqListRow[];
      total: number;
      page: number;
      limit: number;
    }>(res);
    expect(status).toBe(200);
    expect(body.rows).toHaveLength(1);
    expect(body.total).toBe(1);
    expect(body.page).toBe(1);
    expect(body.limit).toBe(25);
  });

  it("allows architect", async () => {
    setupAuth(mocks.auth, architectSession);
    const res = await GET_LIST(
      buildRequest(`/api/projects/${PROJECT_ID}/rfqs`),
      buildParams({ id: PROJECT_ID })
    );
    expect(res.status).toBe(200);
  });

  it("blocks client", async () => {
    setupAuth(mocks.auth, clientSession);
    const res = await GET_LIST(
      buildRequest(`/api/projects/${PROJECT_ID}/rfqs`),
      buildParams({ id: PROJECT_ID })
    );
    expect(res.status).toBe(403);
  });

  it("blocks vendor", async () => {
    setupAuth(mocks.auth, vendorSession);
    const res = await GET_LIST(
      buildRequest(`/api/projects/${PROJECT_ID}/rfqs`),
      buildParams({ id: PROJECT_ID })
    );
    expect(res.status).toBe(403);
  });

  it("403 when project access denied", async () => {
    vi.mocked(hasProjectAccess).mockResolvedValue(false);
    const res = await GET_LIST(
      buildRequest(`/api/projects/${PROJECT_ID}/rfqs`),
      buildParams({ id: PROJECT_ID })
    );
    expect(res.status).toBe(403);
  });

  it("rejects an invalid status filter", async () => {
    const res = await GET_LIST(
      buildRequest(`/api/projects/${PROJECT_ID}/rfqs`, {
        searchParams: { status: "not_a_real_status" },
      }),
      buildParams({ id: PROJECT_ID })
    );
    const { status } = await parseResponse(res);
    expect(status).toBe(400);
  });

  it("passes parsed filters through to the query", async () => {
    await GET_LIST(
      buildRequest(`/api/projects/${PROJECT_ID}/rfqs`, {
        searchParams: {
          status: "issued",
          search: "plumb",
          page: "2",
          limit: "10",
        },
      }),
      buildParams({ id: PROJECT_ID })
    );
    expect(vi.mocked(getRfqsByProject)).toHaveBeenCalledWith(
      PROJECT_ID,
      expect.objectContaining({
        status: "issued",
        search: "plumb",
        page: 2,
        limit: 10,
      })
    );
  });
});
