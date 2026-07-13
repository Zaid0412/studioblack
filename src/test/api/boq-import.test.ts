import { describe, it, expect, beforeEach, vi } from "vitest";
import ExcelJS from "exceljs";
import { NextRequest } from "next/server";
import { POST } from "@/app/api/projects/[id]/boq/import/route";
import {
  getBoqByProject,
  getCategoryTree,
  getElementsByCodeMap,
} from "@/lib/queries";
import {
  mockSession,
  setupAuth,
  parseResponse,
  BASE_URL,
  buildParams,
  SERVICE_AREA_CHAIN,
  SERVICE_AREA_PATH,
} from "../helpers";
import { mocks } from "../setup";

const PROJECT_ID = "11111111-1111-4111-8111-111111111111";
const BOQ_ID = "22222222-2222-4222-8222-222222222222";

const HEADERS = [
  "Category Path",
  "Description",
  "Unit",
  "Quantity",
  "Unit Cost",
];
const SERVICE_AREA_CELL = SERVICE_AREA_PATH.join(" > ");

async function sheetBuffer(
  rows: (string | number | null)[][],
  headers: string[] = HEADERS
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("BOQ");
  ws.addRow(headers);
  for (const r of rows) ws.addRow(r);
  return Buffer.from(await wb.xlsx.writeBuffer());
}

function buildUploadRequest(file: File) {
  const fd = new FormData();
  fd.append("file", file);
  return new NextRequest(
    new URL(`/api/projects/${PROJECT_ID}/boq/import`, BASE_URL),
    {
      method: "POST",
      headers: { origin: BASE_URL, host: "localhost:3000" },
      body: fd,
    }
  );
}

const pmSession = mockSession();
const clientSession = mockSession({ role: "client" });

function stubBoq(status: "draft" | "locked" | null = "draft") {
  if (status === null) {
    vi.mocked(getBoqByProject).mockResolvedValue(null);
    return;
  }
  vi.mocked(getBoqByProject).mockResolvedValue({
    id: BOQ_ID,
    project_id: PROJECT_ID,
    title: "Test BOQ",
    version: 1,
    status,
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

beforeEach(() => {
  vi.clearAllMocks();
  setupAuth(mocks.auth, pmSession);
  stubBoq("draft");
  vi.mocked(getElementsByCodeMap).mockResolvedValue(new Map());
  vi.mocked(getCategoryTree).mockResolvedValue(
    SERVICE_AREA_CHAIN.map((c) => ({ ...c, element_count: 0 }))
  );
});

describe("POST /api/projects/[id]/boq/import", () => {
  it("parses a valid sheet and returns rows + boqId", async () => {
    const buf = await sheetBuffer([
      [SERVICE_AREA_CELL, "Slab 100mm", "m2", 50, 45],
    ]);
    const file = new File([buf], "boq.xlsx", {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });

    const res = await POST(
      buildUploadRequest(file),
      buildParams({ id: PROJECT_ID })
    );
    const { status, body } = await parseResponse<{
      boqId: string;
      rows: Array<{ status: string }>;
      missingColumns: string[];
    }>(res);

    expect(status).toBe(200);
    expect(body.boqId).toBe(BOQ_ID);
    expect(body.missingColumns).toEqual([]);
    expect(body.rows).toHaveLength(1);
    expect(body.rows[0].status).toBe("valid");
  });

  it("returns 404 when the project has no BOQ yet", async () => {
    stubBoq(null);
    const buf = await sheetBuffer([["Item", "m2", 1, 1]]);
    const file = new File([buf], "boq.xlsx", {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });

    const res = await POST(
      buildUploadRequest(file),
      buildParams({ id: PROJECT_ID })
    );
    expect(res.status).toBe(404);
  });

  it("denies client role with 403", async () => {
    setupAuth(mocks.auth, clientSession);
    const buf = await sheetBuffer([["Item", "m2", 1, 1]]);
    const file = new File([buf], "boq.xlsx", {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });

    const res = await POST(
      buildUploadRequest(file),
      buildParams({ id: PROJECT_ID })
    );
    expect(res.status).toBe(403);
  });

  it("rejects a file with a non-.xlsx extension", async () => {
    const file = new File(["hello"], "notes.txt", { type: "text/plain" });
    const res = await POST(
      buildUploadRequest(file),
      buildParams({ id: PROJECT_ID })
    );
    const { status, body } = await parseResponse<{ error: string }>(res);
    expect(status).toBe(400);
    expect(body.error).toMatch(/\.xlsx/);
  });

  it("rejects files exceeding the 5MB limit with 413", async () => {
    const big = new Uint8Array(6 * 1024 * 1024);
    const file = new File([big], "big.xlsx", {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });

    const res = await POST(
      buildUploadRequest(file),
      buildParams({ id: PROJECT_ID })
    );
    expect(res.status).toBe(413);
  });

  it("rejects a renamed non-zip masquerading as .xlsx", async () => {
    const bogus = Buffer.from("not a zip — but looks like one to MIME");
    const file = new File([bogus], "fake.xlsx", {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });

    const res = await POST(
      buildUploadRequest(file),
      buildParams({ id: PROJECT_ID })
    );
    const { status, body } = await parseResponse<{ error: string }>(res);
    expect(status).toBe(400);
    expect(body.error).toMatch(/\.xlsx/);
  });

  it("returns 400 when no file is attached", async () => {
    const fd = new FormData();
    const req = new NextRequest(
      new URL(`/api/projects/${PROJECT_ID}/boq/import`, BASE_URL),
      {
        method: "POST",
        headers: { origin: BASE_URL, host: "localhost:3000" },
        body: fd,
      }
    );

    const res = await POST(req, buildParams({ id: PROJECT_ID }));
    const { status, body } = await parseResponse<{ error: string }>(res);
    expect(status).toBe(400);
    expect(body.error).toMatch(/No file/);
  });

  it("surfaces missing required columns", async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("BOQ");
    ws.addRow(["Description"]);
    ws.addRow(["Only a description"]);
    const buf = Buffer.from(await wb.xlsx.writeBuffer());
    const file = new File([buf], "x.xlsx", {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });

    const res = await POST(
      buildUploadRequest(file),
      buildParams({ id: PROJECT_ID })
    );
    const { status, body } = await parseResponse<{ missingColumns: string[] }>(
      res
    );
    expect(status).toBe(200);
    expect(body.missingColumns).toEqual(
      expect.arrayContaining(["Unit", "Quantity", "Unit Cost"])
    );
  });
});
