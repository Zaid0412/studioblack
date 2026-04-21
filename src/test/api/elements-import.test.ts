import { describe, it, expect, beforeEach, vi } from "vitest";
import ExcelJS from "exceljs";
import { bulkUpsertElements, getCategoryTree } from "@/lib/queries";
import { POST as POST_IMPORT } from "@/app/api/elements/import/route";
import { POST as POST_CONFIRM } from "@/app/api/elements/import/confirm/route";
import { mockSession, setupAuth, parseResponse, BASE_URL } from "../helpers";
import { mocks } from "../setup";
import { NextRequest } from "next/server";
import type { ElementCategory } from "@/types";

// ── Fixtures ────────────────────────────────────────────────────────────────

function makeCategory(
  id: string,
  name: string,
  parent_id: string | null,
  level: 1 | 2 | 3
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

const CATEGORIES: ElementCategory[] = [
  makeCategory("cat-f", "Finishes", null, 1),
  makeCategory("cat-wf", "Wall Finishes", "cat-f", 2),
];

const HEADERS = [
  "Code",
  "Name",
  "Category Path",
  "Unit",
  "Unit Cost",
  "Currency",
];

async function sheetBuffer(
  rows: (string | number | null)[][]
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Elements");
  ws.addRow(HEADERS);
  for (const r of rows) ws.addRow(r);
  return Buffer.from(await wb.xlsx.writeBuffer());
}

function buildUploadRequest(file: File, path = "/api/elements/import") {
  const fd = new FormData();
  fd.append("file", file);
  return new NextRequest(new URL(path, BASE_URL), {
    method: "POST",
    headers: { origin: BASE_URL, host: "localhost:3000" },
    body: fd,
  });
}

function buildJsonRequest(path: string, body: unknown) {
  return new NextRequest(new URL(path, BASE_URL), {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: BASE_URL,
      host: "localhost:3000",
    },
    body: JSON.stringify(body),
  });
}

const pmSession = mockSession();
const clientSession = mockSession({ role: "client" });

beforeEach(() => {
  vi.clearAllMocks();
  setupAuth(mocks.auth, pmSession);
  vi.mocked(getCategoryTree).mockResolvedValue(
    CATEGORIES.map((c) => ({ ...c, element_count: 0 }))
  );
});

// ── POST /api/elements/import ───────────────────────────────────────────────

describe("POST /api/elements/import", () => {
  it("parses a valid sheet and returns rows + template checks", async () => {
    const buf = await sheetBuffer([
      [
        "WAL-PNT-001",
        "White Paint",
        "Finishes > Wall Finishes",
        "m2",
        10,
        "USD",
      ],
    ]);
    const file = new File([buf], "elements.xlsx", {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });

    const res = await POST_IMPORT(buildUploadRequest(file));
    const { status, body } = await parseResponse<{
      rows: { code: string; status: string }[];
      missingColumns: string[];
    }>(res);

    expect(status).toBe(200);
    expect(body.missingColumns).toEqual([]);
    expect(body.rows).toHaveLength(1);
    expect(body.rows[0].status).toBe("valid");
  });

  it("rejects a non-xlsx file by extension", async () => {
    const file = new File(["hello"], "notes.txt", { type: "text/plain" });
    const res = await POST_IMPORT(buildUploadRequest(file));
    const { status, body } = await parseResponse<{ error: string }>(res);
    expect(status).toBe(400);
    expect(body.error).toMatch(/\.xlsx/);
  });

  it("rejects an oversize file with 413", async () => {
    const big = new Uint8Array(6 * 1024 * 1024);
    const file = new File([big], "big.xlsx", {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const res = await POST_IMPORT(buildUploadRequest(file));
    const { status } = await parseResponse(res);
    expect(status).toBe(413);
  });

  it("returns 400 when no file is in the form", async () => {
    const fd = new FormData();
    const req = new NextRequest(new URL("/api/elements/import", BASE_URL), {
      method: "POST",
      headers: { origin: BASE_URL, host: "localhost:3000" },
      body: fd,
    });
    const res = await POST_IMPORT(req);
    const { status, body } = await parseResponse<{ error: string }>(res);
    expect(status).toBe(400);
    expect(body.error).toMatch(/No file/);
  });

  it("denies client role with 403", async () => {
    setupAuth(mocks.auth, clientSession);
    const buf = await sheetBuffer([["X", "Y", "Finishes", "m2", 1, "USD"]]);
    const file = new File([buf], "x.xlsx", {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const res = await POST_IMPORT(buildUploadRequest(file));
    expect(res.status).toBe(403);
  });

  it("surfaces unknown and missing columns", async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Elements");
    ws.addRow(["Code", "Name", "Mystery"]); // missing Unit + Unit Cost
    ws.addRow(["A", "B", "zz"]);
    const buf = Buffer.from(await wb.xlsx.writeBuffer());
    const file = new File([buf], "x.xlsx", {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });

    const res = await POST_IMPORT(buildUploadRequest(file));
    const { status, body } = await parseResponse<{
      unknownColumns: string[];
      missingColumns: string[];
    }>(res);
    expect(status).toBe(200);
    expect(body.unknownColumns).toContain("Mystery");
    expect(body.missingColumns).toEqual(
      expect.arrayContaining(["Unit", "Unit Cost"])
    );
  });
});

// ── POST /api/elements/import/confirm ───────────────────────────────────────

describe("POST /api/elements/import/confirm", () => {
  const goodRow = {
    rowNumber: 1,
    code: "WAL-PNT-002",
    name: "Grey Paint",
    unit: "m2",
    unitCost: 10,
  };

  it("calls bulkUpsertElements with skip strategy and returns counts", async () => {
    vi.mocked(bulkUpsertElements).mockResolvedValue({
      inserted: 1,
      updated: 0,
      skipped: 0,
      versioned: 0,
      failed: [],
    });
    const req = buildJsonRequest("/api/elements/import/confirm", {
      strategy: "skip",
      rows: [goodRow],
    });
    const res = await POST_CONFIRM(req);
    const { status, body } = await parseResponse<{ inserted: number }>(res);

    expect(status).toBe(200);
    expect(body.inserted).toBe(1);
    expect(bulkUpsertElements).toHaveBeenCalledWith(
      "org-test-001",
      expect.objectContaining({ strategy: "skip", rows: [goodRow] })
    );
  });

  it("accepts overwrite strategy", async () => {
    vi.mocked(bulkUpsertElements).mockResolvedValue({
      inserted: 0,
      updated: 3,
      skipped: 0,
      versioned: 0,
      failed: [],
    });
    const req = buildJsonRequest("/api/elements/import/confirm", {
      strategy: "overwrite",
      rows: [goodRow],
    });
    const res = await POST_CONFIRM(req);
    const { body } = await parseResponse<{ updated: number }>(res);
    expect(body.updated).toBe(3);
  });

  it("accepts version strategy", async () => {
    vi.mocked(bulkUpsertElements).mockResolvedValue({
      inserted: 0,
      updated: 0,
      skipped: 0,
      versioned: 2,
      failed: [],
    });
    const req = buildJsonRequest("/api/elements/import/confirm", {
      strategy: "version",
      rows: [goodRow],
    });
    const res = await POST_CONFIRM(req);
    const { body } = await parseResponse<{ versioned: number }>(res);
    expect(body.versioned).toBe(2);
  });

  it("rejects an invalid strategy", async () => {
    const req = buildJsonRequest("/api/elements/import/confirm", {
      strategy: "bogus",
      rows: [goodRow],
    });
    const res = await POST_CONFIRM(req);
    expect(res.status).toBe(400);
  });

  it("rejects a row missing required fields", async () => {
    const req = buildJsonRequest("/api/elements/import/confirm", {
      strategy: "skip",
      rows: [{ rowNumber: 1, code: "X" }], // missing name/unit/unitCost
    });
    const res = await POST_CONFIRM(req);
    expect(res.status).toBe(400);
  });

  it("rejects an empty rows array", async () => {
    const req = buildJsonRequest("/api/elements/import/confirm", {
      strategy: "skip",
      rows: [],
    });
    const res = await POST_CONFIRM(req);
    expect(res.status).toBe(400);
  });

  it("denies client role with 403", async () => {
    setupAuth(mocks.auth, clientSession);
    const req = buildJsonRequest("/api/elements/import/confirm", {
      strategy: "skip",
      rows: [goodRow],
    });
    const res = await POST_CONFIRM(req);
    expect(res.status).toBe(403);
  });
});
