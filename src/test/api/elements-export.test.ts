import { describe, it, expect, beforeEach, vi } from "vitest";
import ExcelJS from "exceljs";
import { getElementsForExport, getCategoryTree } from "@/lib/queries";
import { GET as GET_EXPORT } from "@/app/api/elements/export/route";
import { buildRequest, mockSession, setupAuth } from "../helpers";
import { mocks } from "../setup";
import type { Element, ElementCategory } from "@/types";

function makeCategory(id: string, name: string): ElementCategory {
  return {
    id,
    org_id: "org-test-001",
    name,
    parent_id: null,
    level: 1,
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
    category_id: null,
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
    created_by: "user-1",
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
    ...overrides,
  };
}

const pmSession = mockSession();
const clientSession = mockSession({ role: "client" });

beforeEach(() => {
  vi.clearAllMocks();
  setupAuth(mocks.auth, pmSession);
  vi.mocked(getCategoryTree).mockResolvedValue([
    { ...makeCategory("cat-f", "Finishes"), element_count: 0 },
  ]);
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

  it("round-trips: export → parse → same codes", async () => {
    vi.mocked(getElementsForExport).mockResolvedValue({
      rows: [
        makeElement({ id: "e1", code: "A-01", name: "One" }),
        makeElement({ id: "e2", code: "A-02", name: "Two" }),
      ],
      total: 2,
      truncated: false,
    });
    const res = await GET_EXPORT(buildRequest("/api/elements/export"));
    expect(res.status).toBe(200);

    const arrayBuf = await res.arrayBuffer();
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(arrayBuf);
    const ws = wb.worksheets[0];
    const codeCol: string[] = [];
    ws.eachRow({ includeEmpty: false }, (row) => {
      const v = row.getCell(1).value;
      codeCol.push(typeof v === "string" ? v : String(v ?? ""));
    });
    expect(codeCol[0]).toBe("Code");
    expect(codeCol.slice(1)).toEqual(["A-01", "A-02"]);
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
