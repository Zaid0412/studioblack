import { describe, it, expect, beforeEach, vi } from "vitest";
import { GET } from "@/app/api/projects/[id]/boq/export/route";
import {
  getBoqByProject,
  getBoqForExport,
  getProjectById,
} from "@/lib/queries";
import {
  BASE_URL,
  buildParams,
  mockSession,
  parseResponse,
  setupAuth,
} from "../helpers";
import { mocks } from "../setup";
import { NextRequest } from "next/server";
import type { BoqWithDetails } from "@/types";

const PROJECT_ID = "11111111-1111-4111-8111-111111111111";
const BOQ_ID = "22222222-2222-4222-8222-222222222222";

const pmSession = mockSession();
const clientSession = mockSession({ role: "client" });

function buildGetRequest() {
  return new NextRequest(
    new URL(`/api/projects/${PROJECT_ID}/boq/export`, BASE_URL),
    { method: "GET", headers: { host: "localhost:3000" } }
  );
}

function stubBoqHeader() {
  vi.mocked(getBoqByProject).mockResolvedValue({
    id: BOQ_ID,
    project_id: PROJECT_ID,
    title: "Test BOQ",
    version: 1,
    status: "draft",
    currency: "USD",
    exchange_rate: "1",
    contingency_pct: "0",
    vat_pct: "0",
    minimum_margin_pct: "10",
    client_id: null,
    architect_id: null,
    issued_date: null,
    approved_date: null,
    notes: null,
    client_notes: null,
    snapshot: null,
    created_by: null,
    created_at: "2026-04-24T00:00:00Z",
    updated_at: "2026-04-24T00:00:00Z",
  });
}

function stubBoqWithItems(itemCount: number): BoqWithDetails {
  const items = Array.from({ length: itemCount }, (_, i) => ({
    id: `item-${i}`,
    boq_id: BOQ_ID,
    section_id: null,
    element_id: null,
    item_code: `BOQ-2026-${String(i + 1).padStart(3, "0")}`,
    description: `Item ${i + 1}`,
    unit: "m2",
    quantity: "1",
    unit_cost: "10",
    material_cost: null,
    labour_cost: null,
    overhead_pct: "0",
    margin_pct: "0",
    lifecycle_status: "draft" as const,
    client_approval_status: "pending" as const,
    client_approved_at: null,
    client_approved_by: null,
    requires_reapproval: false,
    element_archived: false,
    installed_qty: "0",
    has_snag: false,
    po_status: "none" as const,
    notes: null,
    client_notes: null,
    sort_order: i,
    is_provisional: false,
    is_excluded: false,
    created_at: "2026-04-24T00:00:00Z",
    updated_at: "2026-04-24T00:00:00Z",
    total_cost: "10",
    subtotal: "10",
    sell_price: "10",
    progress_pct: "0",
    margin_alert: false,
  }));

  return {
    id: BOQ_ID,
    project_id: PROJECT_ID,
    title: "Test BOQ",
    version: 1,
    status: "draft",
    currency: "USD",
    exchange_rate: "1",
    contingency_pct: "0",
    vat_pct: "0",
    minimum_margin_pct: "10",
    client_id: null,
    architect_id: null,
    issued_date: null,
    approved_date: null,
    notes: null,
    client_notes: null,
    snapshot: null,
    created_by: null,
    created_at: "2026-04-24T00:00:00Z",
    updated_at: "2026-04-24T00:00:00Z",
    sections: [],
    items,
    summary: {
      total_cost: "0",
      total_sell_price: "0",
      subtotal: "0",
      pre_vat_total: "0",
      client_total: "0",
      average_margin_pct: "0",
      margin_bleed_count: 0,
      pending_approvals: 0,
      item_count: itemCount,
      section_totals: [],
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  setupAuth(mocks.auth, pmSession);
  stubBoqHeader();
  vi.mocked(getBoqForExport).mockResolvedValue(stubBoqWithItems(2));
  vi.mocked(getProjectById).mockResolvedValue({
    id: PROJECT_ID,
    name: "Acme HQ",
  } as unknown as Awaited<ReturnType<typeof getProjectById>>);
});

describe("GET /api/projects/[id]/boq/export", () => {
  it("returns an xlsx blob with X-Boq-Item-Count header", async () => {
    const res = await GET(buildGetRequest(), buildParams({ id: PROJECT_ID }));
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("spreadsheetml");
    expect(res.headers.get("X-Boq-Item-Count")).toBe("2");
    const buf = Buffer.from(await res.arrayBuffer());
    // ZIP magic header — xlsx files are ZIP archives.
    expect(buf.subarray(0, 4).toString("hex")).toBe("504b0304");
  });

  it("sets Content-Disposition with a slugified project name", async () => {
    const res = await GET(buildGetRequest(), buildParams({ id: PROJECT_ID }));
    const cd = res.headers.get("Content-Disposition") ?? "";
    expect(cd).toMatch(/acme-hq-BOQ-/);
    expect(cd).toMatch(/\.xlsx/);
  });

  it("returns 404 when the project has no BOQ", async () => {
    vi.mocked(getBoqByProject).mockResolvedValue(null);
    const res = await GET(buildGetRequest(), buildParams({ id: PROJECT_ID }));
    expect(res.status).toBe(404);
  });

  it("denies the client role with 403", async () => {
    setupAuth(mocks.auth, clientSession);
    const res = await GET(buildGetRequest(), buildParams({ id: PROJECT_ID }));
    expect(res.status).toBe(403);
  });

  it("falls back to 'project' in the filename when the project has no name", async () => {
    vi.mocked(getProjectById).mockResolvedValue(
      null as unknown as Awaited<ReturnType<typeof getProjectById>>
    );
    const res = await GET(buildGetRequest(), buildParams({ id: PROJECT_ID }));
    const cd = res.headers.get("Content-Disposition") ?? "";
    expect(cd).toMatch(/project-BOQ-/);
  });

  it("denies an unauthenticated caller", async () => {
    setupAuth(mocks.auth, null);
    const res = await GET(buildGetRequest(), buildParams({ id: PROJECT_ID }));
    expect(res.status).toBe(401);
    void parseResponse; // silence unused
  });
});
