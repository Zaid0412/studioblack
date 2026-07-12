import { describe, it, expect, beforeEach, vi } from "vitest";
import { getElementsForExport, getCategoryTree } from "@/lib/queries";
import { GET as GET_EXPORT } from "@/app/api/elements/export/route";
import { parseElementSheet } from "@/lib/excel/elementParser";
import { buildRequest, mockSession, setupAuth } from "../helpers";
import { mocks } from "../setup";
import type { Element, ElementCategory } from "@/types";

function makeCategory(
  id: string,
  name: string,
  parent_id: string | null = null,
  level: 1 | 2 | 3 = 1
): ElementCategory {
  return {
    id,
    org_id: "org-test-001",
    name,
    parent_id,
    level,
    code_prefix: null,
    sort_order: 0,
    icon: null,
    color: null,
    is_active: true,
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
  };
}

function makeElement(overrides: Partial<Element> = {}): Element {
  return {
    id: "e1",
    org_id: "org-test-001",
    code: "A-01",
    name: "Test",
    description: null,
    category_id: "cat-pt",
    unit: "m2",
    unit_cost: "10",
    currency: "USD",
    material_cost: null,
    labour_cost: null,
    overhead_pct: null,
    margin_pct: null,
    spec_reference: null,
    drawing_ref: null,
    tags: null,
    is_active: true,
    version_group: "11111111-2222-3333-4444-555555555555",
    version_number: 1,
    created_by: "user-1",
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
    ...overrides,
  };
}

// Elements must sit under a Service Area, so the export writes a full path and
// the round-trip needs the same tree to resolve it back.
const CATEGORIES: ElementCategory[] = [
  makeCategory("cat-f", "Finishes"),
  makeCategory("cat-wf", "Wall Finishes", "cat-f", 2),
  makeCategory("cat-pt", "Paint", "cat-wf", 3),
];

const pmSession = mockSession();
const clientSession = mockSession({ role: "client" });

beforeEach(() => {
  vi.clearAllMocks();
  setupAuth(mocks.auth, pmSession);
  vi.mocked(getCategoryTree).mockResolvedValue(
    CATEGORIES.map((c) => ({ ...c, element_count: 0 }))
  );
});

describe("GET /api/elements/export", () => {
  it("returns an xlsx with the right content-type and attachment filename", async () => {
    vi.mocked(getElementsForExport).mockResolvedValue({
      rows: [makeElement()],
      total: 1,
      truncated: false,
    });
    const res = await GET_EXPORT(buildRequest("/api/elements/export"));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe(
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    expect(res.headers.get("content-disposition")).toMatch(
      /attachment; filename="elements-\d{4}-\d{2}-\d{2}\.xlsx"/
    );
    expect(res.headers.get("x-element-count")).toBe("1");
    expect(res.headers.get("x-export-truncated")).toBeNull();
  });

  it("round-trips: export → parseElementSheet → same values", async () => {
    vi.mocked(getElementsForExport).mockResolvedValue({
      rows: [
        makeElement({
          id: "e1",
          code: "A-01",
          name: "One",
          unit: "m2",
          unit_cost: "12.5",
          currency: "USD",
        }),
        makeElement({
          id: "e2",
          code: "A-02",
          name: "Two",
          unit: "lm",
          unit_cost: "99.99",
          currency: "USD",
        }),
      ],
      total: 2,
      truncated: false,
    });
    const res = await GET_EXPORT(buildRequest("/api/elements/export"));
    expect(res.status).toBe(200);

    // Feed the exported bytes back through the parser to catch writer/parser
    // drift (missing template column, wrong label, numFmt changing cell type).
    const arrayBuf = await res.arrayBuffer();
    const parse = await parseElementSheet(Buffer.from(arrayBuf), CATEGORIES);

    expect(parse.missingColumns).toEqual([]);
    expect(parse.duplicateColumns ?? []).toEqual([]);
    expect(parse.rows).toHaveLength(2);

    const [r1, r2] = parse.rows;
    expect(r1.status).toBe("valid");
    expect(r1.parsed?.code).toBe("A-01");
    expect(r1.parsed?.name).toBe("One");
    expect(r1.parsed?.unit).toBe("m2");
    expect(r1.parsed?.unitCost).toBe(12.5);
    expect(r1.parsed?.currency).toBe("USD");
    expect(r2.status).toBe("valid");
    expect(r2.parsed?.code).toBe("A-02");
    expect(r2.parsed?.unit).toBe("lm");
    expect(r2.parsed?.unitCost).toBe(99.99);
  });

  it("sets truncated header when the export cap is hit", async () => {
    vi.mocked(getElementsForExport).mockResolvedValue({
      rows: [makeElement()],
      total: 10_001,
      truncated: true,
    });
    const res = await GET_EXPORT(buildRequest("/api/elements/export"));
    expect(res.headers.get("x-export-truncated")).toBe("true");
  });

  it("passes filter params through to getElementsForExport", async () => {
    vi.mocked(getElementsForExport).mockResolvedValue({
      rows: [],
      total: 0,
      truncated: false,
    });
    await GET_EXPORT(buildRequest("/api/elements/export?search=paint&unit=m2"));
    expect(getElementsForExport).toHaveBeenCalledWith(
      "org-test-001",
      expect.objectContaining({ search: "paint", unit: "m2" })
    );
  });

  it("ignores page/limit from the query string", async () => {
    vi.mocked(getElementsForExport).mockResolvedValue({
      rows: [],
      total: 0,
      truncated: false,
    });
    await GET_EXPORT(buildRequest("/api/elements/export?page=7&limit=10"));
    const callArg = vi.mocked(getElementsForExport).mock.calls[0][1] ?? {};
    expect("page" in callArg).toBe(false);
    expect("limit" in callArg).toBe(false);
  });

  it("denies client role with 403", async () => {
    setupAuth(mocks.auth, clientSession);
    const res = await GET_EXPORT(buildRequest("/api/elements/export"));
    expect(res.status).toBe(403);
  });
});
