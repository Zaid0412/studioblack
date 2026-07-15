import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";
import ExcelJS from "exceljs";
import { POST as PREVIEW } from "@/app/api/element-categories/import/route";
import { POST as CONFIRM } from "@/app/api/element-categories/import/confirm/route";
import {
  applyCategoryImport,
  planCategoryImport,
  CategoryImportBlockedError,
} from "@/lib/queries/categoryImport";
import {
  buildRequest,
  mockSession,
  setupAuth,
  parseResponse,
} from "../helpers";
import { mocks } from "../setup";

vi.mock("@/lib/queries/categoryImport", async () => {
  const actual = await vi.importActual<
    typeof import("@/lib/queries/categoryImport")
  >("@/lib/queries/categoryImport");
  return {
    ...actual,
    planCategoryImport: vi.fn(),
    applyCategoryImport: vi.fn(),
  };
});

const pmSession = mockSession();
const clientSession = mockSession({ role: "client" });

const HEADERS = [
  "Category",
  "Category Code",
  "Sub-category",
  "Sub-category Code",
  "Service Area",
  "Service Area Code",
];

async function sheetBuffer(rows: string[][]): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Categories");
  ws.addRow(HEADERS);
  for (const r of rows) ws.addRow(r);
  return Buffer.from(await wb.xlsx.writeBuffer());
}

const BASE_URL = "http://localhost:3000";

function uploadRequest(buffer: Buffer, filename = "categories.xlsx") {
  const form = new FormData();
  form.append("file", new File([new Uint8Array(buffer)], filename));
  return new NextRequest(new URL("/api/element-categories/import", BASE_URL), {
    method: "POST",
    headers: { origin: BASE_URL, host: "localhost:3000" },
    body: form,
  });
}

const EMPTY_PLAN = {
  creates: [],
  updates: [],
  deletes: [],
  blocked: [],
};

beforeEach(() => {
  vi.clearAllMocks();
  setupAuth(mocks.auth, pmSession);
});

describe("POST /api/element-categories/import", () => {
  it("parses a sheet and returns the plan it implies", async () => {
    vi.mocked(planCategoryImport).mockResolvedValue({
      ...EMPTY_PLAN,
      creates: [{ path: ["Kitchen"], codePrefix: "KIT", level: 1 }],
    });

    const buffer = await sheetBuffer([
      ["Kitchen", "KIT", "Cabinets", "CAB", "Base Cabinets", "BASE"],
    ]);
    const res = await PREVIEW(uploadRequest(buffer));
    const { status, body } = await parseResponse<{
      rows: { status: string }[];
      plan: { creates: unknown[] } | null;
    }>(res);

    expect(status).toBe(200);
    expect(body.rows[0].status).toBe("valid");
    expect(body.plan?.creates).toHaveLength(1);
  });

  /**
   * A broken row can't just be skipped: the paths it would have declared would
   * be absent from the plan, so they'd read as deletions and the preview would
   * announce we're about to remove them.
   */
  it("withholds the plan when any row failed to parse", async () => {
    // No Category — the one rung a row cannot omit.
    const buffer = await sheetBuffer([["", "", "Cabinets", "CAB", "", ""]]);
    const res = await PREVIEW(uploadRequest(buffer));
    const { body } = await parseResponse<{ plan: unknown | null }>(res);

    expect(body.plan).toBeNull();
    expect(planCategoryImport).not.toHaveBeenCalled();
  });

  it("rejects a file that isn't a spreadsheet", async () => {
    const res = await PREVIEW(
      uploadRequest(Buffer.from("not a spreadsheet"), "taxonomy.xlsx")
    );
    const { status } = await parseResponse(res);

    expect(status).toBe(400);
  });

  it("accepts a .csv", async () => {
    vi.mocked(planCategoryImport).mockResolvedValue(EMPTY_PLAN);

    const csv = Buffer.from(
      [HEADERS.join(","), "Kitchen,KIT,Cabinets,CAB,Base Cabinets,BASE"].join(
        "\n"
      )
    );
    const res = await PREVIEW(uploadRequest(csv, "categories.csv"));
    const { status, body } = await parseResponse<{
      rows: { status: string }[];
    }>(res);

    expect(status).toBe(200);
    expect(body.rows[0].status).toBe("valid");
  });

  it("is closed to clients", async () => {
    setupAuth(mocks.auth, clientSession);
    const buffer = await sheetBuffer([]);
    const res = await PREVIEW(uploadRequest(buffer));
    const { status } = await parseResponse(res);

    expect(status).toBe(403);
  });
});

describe("POST /api/element-categories/import/confirm", () => {
  const body = {
    paths: [
      [
        { name: "Kitchen", codePrefix: "KIT" },
        { name: "Cabinets", codePrefix: "KIT-CAB" },
      ],
    ],
  };

  it("applies the import", async () => {
    vi.mocked(applyCategoryImport).mockResolvedValue({
      created: 2,
      updated: 0,
      deleted: 1,
    });

    const res = await CONFIRM(
      buildRequest("/api/element-categories/import/confirm", {
        method: "POST",
        body,
      })
    );
    const { status, body: out } = await parseResponse<{ created: number }>(res);

    expect(status).toBe(200);
    expect(out.created).toBe(2);
  });

  /**
   * The whole point of the feature: a category still in use is never deleted.
   * The client gets back what is holding it, and nothing was written.
   */
  it("refuses with 409 when a dropped category is still in use", async () => {
    const blocked = [
      {
        id: "base",
        path: ["Kitchen", "Cabinets", "Base Cabinets"],
        references: {
          elements: 3,
          vendorTrades: 0,
          boqItems: 0,
          rfqItems: 0,
          rateContracts: 0,
          rateContractItems: 1,
        },
      },
    ];
    vi.mocked(applyCategoryImport).mockRejectedValue(
      new CategoryImportBlockedError(blocked)
    );

    const res = await CONFIRM(
      buildRequest("/api/element-categories/import/confirm", {
        method: "POST",
        body,
      })
    );
    const { status, body: out } = await parseResponse<{
      blocked: { references: { elements: number } }[];
    }>(res);

    expect(status).toBe(409);
    expect(out.blocked[0].references.elements).toBe(3);
  });

  it("rejects an empty chain", async () => {
    const res = await CONFIRM(
      buildRequest("/api/element-categories/import/confirm", {
        method: "POST",
        body: { paths: [[]] },
      })
    );
    const { status } = await parseResponse(res);

    expect(status).toBe(400);
    expect(applyCategoryImport).not.toHaveBeenCalled();
  });

  it("is closed to clients", async () => {
    setupAuth(mocks.auth, clientSession);
    const res = await CONFIRM(
      buildRequest("/api/element-categories/import/confirm", {
        method: "POST",
        body,
      })
    );
    const { status } = await parseResponse(res);

    expect(status).toBe(403);
  });
});
