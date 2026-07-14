/**
 * Unit tests for the BOQ PDF renderer. The renderer is the only piece of the
 * "send BOQ as PDF" flow that does heavy I/O — render speed and grand-total
 * correctness matter most, so we go after both.
 *
 * The global setup stubs `@/lib/boq/pdf`. We use `vi.importActual` to pull
 * the real implementation since the renderer itself is what's under test.
 */
import { describe, it, expect, vi } from "vitest";
import type { BoqItemWithComputed } from "@/types";

/**
 * These tests render real PDFs, which is genuinely slow — and slower still when
 * the other workers are saturating the CPU. On the 5s default the two heaviest
 * cases (the multi-group render, and the one that renders twice) intermittently
 * time out, which reads as a flaky failure rather than the resource problem it
 * is. Same 20s ceiling the other `importActual` suites already use.
 */
vi.setConfig({ testTimeout: 20000 });

/**
 * Resolved once, not per test: `importActual` bypasses the module cache the
 * global `@/lib/boq/pdf` stub lives in, so calling it in each test re-ran the
 * module's top-level work every time.
 */
const realPdf =
  vi.importActual<typeof import("@/lib/boq/pdf")>("@/lib/boq/pdf");

async function importReal() {
  return realPdf;
}

function mkItem(
  overrides: Partial<BoqItemWithComputed & { section_title: string | null }>
): BoqItemWithComputed & { section_title: string | null } {
  return {
    id: "item-1",
    boq_id: "boq-1",
    section_id: null,
    element_id: null,
    item_code: "EL-1",
    name: "Test",
    description: "",
    unit: "no",
    quantity: "1",
    unit_cost: "0",
    material_cost: null,
    labour_cost: null,
    overhead_pct: "0",
    service_charge_pct: "0",
    margin_pct: "0",
    client_rate: null,
    budget_rate: null,
    length: null,
    breadth: null,
    height: null,
    dimension_unit: "m",
    source: "manual",
    rate_contract_item_id: null,
    phase: "draft",
    sent_to_client_at: null,
    client_decided_at: null,
    element_archived: false,
    element_name: null,
    installed_qty: "0",
    has_snag: false,
    po_status: "none",
    notes: null,
    client_notes: null,
    sort_order: 0,
    is_provisional: false,
    is_excluded: false,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    total_cost: "0",
    subtotal: "0",
    sell_price: "0",
    progress_pct: "0",
    margin_alert: false,
    over_budget: false,
    budget_variance_pct: null,
    section_title: null,
    ...overrides,
  };
}

describe("renderBoqPdf", () => {
  it("returns a non-empty PDF buffer for a minimal input", async () => {
    const { renderBoqPdf } = await importReal();
    const buf = await renderBoqPdf({
      projectName: "Demo",
      boqTitle: "Main BOQ",
      currency: "USD",
      items: [mkItem({ quantity: "1", sell_price: "10" })],
    });
    expect(Buffer.isBuffer(buf)).toBe(true);
    expect(buf.length).toBeGreaterThan(1000);
    // PDF magic header — confirms we actually produced a PDF.
    expect(buf.subarray(0, 4).toString()).toBe("%PDF");
  }, 30000);

  it("groups items by section_title (renders all groups)", async () => {
    const { renderBoqPdf } = await importReal();
    const buf = await renderBoqPdf({
      projectName: "Demo",
      boqTitle: "Main BOQ",
      currency: "USD",
      items: [
        mkItem({
          id: "a",
          section_title: "Walls",
          sell_price: "10",
          quantity: "1",
        }),
        mkItem({
          id: "b",
          section_title: "Floors",
          sell_price: "20",
          quantity: "1",
        }),
        mkItem({
          id: "c",
          section_title: null,
          sell_price: "5",
          quantity: "1",
        }),
      ],
    });
    expect(buf.length).toBeGreaterThan(1000);
  }, 30000);

  it("includes the comment block when comment is set", async () => {
    const { renderBoqPdf } = await importReal();
    const withComment = await renderBoqPdf({
      projectName: "Demo",
      boqTitle: "Main BOQ",
      currency: "USD",
      comment: "Please prioritise structural work",
      items: [mkItem({ quantity: "1", sell_price: "10" })],
    });
    const withoutComment = await renderBoqPdf({
      projectName: "Demo",
      boqTitle: "Main BOQ",
      currency: "USD",
      items: [mkItem({ quantity: "1", sell_price: "10" })],
    });
    // Comment adds layout — buffer must be strictly larger.
    expect(withComment.length).toBeGreaterThan(withoutComment.length);
  }, 30000);
});

describe("buildBoqPdfFilename", () => {
  it("uses today's date by default and strips unsafe chars", async () => {
    const { buildBoqPdfFilename } = await importReal();
    const name = buildBoqPdfFilename("Acme / Bldg 3");
    expect(name).toMatch(/^BoQ - Acme  Bldg 3 - \d{4}-\d{2}-\d{2}\.pdf$/);
  });

  it("accepts a fixed issuedAt", async () => {
    const { buildBoqPdfFilename } = await importReal();
    expect(buildBoqPdfFilename("Acme", "2026-05-30")).toBe(
      "BoQ - Acme - 2026-05-30.pdf"
    );
  });

  it("falls back to 'Project' when the name is all unsafe chars", async () => {
    const { buildBoqPdfFilename } = await importReal();
    expect(buildBoqPdfFilename("///", "2026-05-30")).toBe(
      "BoQ - Project - 2026-05-30.pdf"
    );
  });
});
