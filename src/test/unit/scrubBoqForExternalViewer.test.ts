/**
 * Pin the BOQ payload-scrub contract for external viewers (client + vendor).
 *
 * `getBoq` filters out items in pre-client phases at the SQL
 * level — but the items it does return still carry cost / margin / budget
 * columns. This scrub is the second line of defence: it zeroes/nulls every
 * studio-internal field BEFORE the response leaves the server, so opening
 * dev tools as a client reveals nothing the UI is trying to hide.
 *
 * Sell-side fields (sell_price, client_rate, subtotal, vat, client_total)
 * must stay — those are the numbers the external viewer will actually be
 * billed.
 */
import { describe, it, expect } from "vitest";
import { scrubBoqForExternalViewer } from "@/lib/queries/boq";
import type { Boq, BoqItemWithComputed, BoqSummary } from "@/types";

const baseBoq: Boq = {
  id: "boq-1",
  project_id: "proj-1",
  title: "Main BOQ",
  version: 1,
  currency: "USD",
  exchange_rate: "1",
  contingency_pct: "5",
  vat_pct: "18",
  minimum_margin_pct: "10",
  client_id: null,
  architect_id: null,
  issued_date: null,
  approved_date: null,
  notes: "INTERNAL — never show to client",
  client_notes: "Shown to client",
  snapshot: null,
  created_by: "user-1",
  created_at: "2024-01-01T00:00:00Z",
  updated_at: "2024-01-01T00:00:00Z",
};

const baseItem: BoqItemWithComputed = {
  id: "item-1",
  boq_id: "boq-1",
  section_id: null,
  element_id: null,
  item_code: "A-1",
  description: "Floor tile",
  unit: "m2",
  quantity: "10",
  unit_cost: "100",
  material_cost: "60",
  labour_cost: "40",
  overhead_pct: "12",
  service_charge_pct: "5",
  margin_pct: "20",
  client_rate: "150",
  budget_rate: "120",
  length: null,
  breadth: null,
  height: null,
  source: "custom",
  rate_contract_item_id: null,
  phase: "sent_to_client",
  sent_to_client_at: null,
  client_decided_at: null,
  element_archived: false,
  installed_qty: "0",
  has_snag: false,
  po_status: "none",
  notes: "INTERNAL note",
  client_notes: "Visible to client",
  sort_order: 0,
  is_provisional: false,
  is_excluded: false,
  created_at: "2024-01-01T00:00:00Z",
  updated_at: "2024-01-01T00:00:00Z",
  // Computed columns
  total_cost: "1000",
  subtotal: "1176",
  sell_price: "1411.20",
  progress_pct: "0",
  margin_alert: true,
  over_budget: true,
  budget_variance_pct: "-16.7",
};

const baseSummary: BoqSummary = {
  total_cost: "1000",
  total_sell_price: "1411.20",
  subtotal: "1176",
  pre_vat_total: "1234.80",
  client_total: "1457.06",
  average_margin_pct: "20",
  margin_bleed_count: 1,
  pending_approvals: 2,
  over_budget_count: 1,
  item_count: 1,
  section_totals: [
    {
      section_id: "sec-1",
      section_title: "Wet Areas",
      total_cost: "1000",
      total_sell_price: "1411.20",
      item_count: 1,
    },
  ],
};

describe("scrubBoqForExternalViewer — items", () => {
  it("zeroes every cost / margin / overhead numeric field", () => {
    const { items } = scrubBoqForExternalViewer({
      boq: baseBoq,
      items: [baseItem],
      summary: baseSummary,
    });
    const [scrubbed] = items;
    expect(scrubbed.unit_cost).toBe("0");
    expect(scrubbed.overhead_pct).toBe("0");
    expect(scrubbed.service_charge_pct).toBe("0");
    expect(scrubbed.margin_pct).toBe("0");
    expect(scrubbed.total_cost).toBe("0");
  });

  it("nulls every internal nullable field", () => {
    const { items } = scrubBoqForExternalViewer({
      boq: baseBoq,
      items: [baseItem],
      summary: baseSummary,
    });
    const [scrubbed] = items;
    expect(scrubbed.material_cost).toBeNull();
    expect(scrubbed.labour_cost).toBeNull();
    expect(scrubbed.budget_rate).toBeNull();
    expect(scrubbed.notes).toBeNull();
    expect(scrubbed.budget_variance_pct).toBeNull();
  });

  it("clears the margin_alert / over_budget flags", () => {
    const { items } = scrubBoqForExternalViewer({
      boq: baseBoq,
      items: [baseItem],
      summary: baseSummary,
    });
    const [scrubbed] = items;
    expect(scrubbed.margin_alert).toBe(false);
    expect(scrubbed.over_budget).toBe(false);
  });

  it("preserves sell-side + client-facing fields", () => {
    const { items } = scrubBoqForExternalViewer({
      boq: baseBoq,
      items: [baseItem],
      summary: baseSummary,
    });
    const [scrubbed] = items;
    expect(scrubbed.sell_price).toBe(baseItem.sell_price);
    expect(scrubbed.client_rate).toBe(baseItem.client_rate);
    expect(scrubbed.subtotal).toBe(baseItem.subtotal);
    expect(scrubbed.client_notes).toBe(baseItem.client_notes);
    expect(scrubbed.quantity).toBe(baseItem.quantity);
    expect(scrubbed.description).toBe(baseItem.description);
    expect(scrubbed.phase).toBe(baseItem.phase);
  });

  it("scrubs every item independently", () => {
    const second: BoqItemWithComputed = {
      ...baseItem,
      id: "item-2",
      unit_cost: "999",
      margin_pct: "50",
    };
    const { items } = scrubBoqForExternalViewer({
      boq: baseBoq,
      items: [baseItem, second],
      summary: baseSummary,
    });
    expect(items).toHaveLength(2);
    expect(items[0].unit_cost).toBe("0");
    expect(items[1].unit_cost).toBe("0");
    expect(items[1].margin_pct).toBe("0");
  });
});

describe("scrubBoqForExternalViewer — boq header", () => {
  it("nulls the BOQ-level internal notes", () => {
    const { boq } = scrubBoqForExternalViewer({
      boq: baseBoq,
      items: [],
      summary: baseSummary,
    });
    expect(boq.notes).toBeNull();
  });

  it("preserves identifiers and client-facing header fields", () => {
    const { boq } = scrubBoqForExternalViewer({
      boq: baseBoq,
      items: [],
      summary: baseSummary,
    });
    expect(boq.id).toBe(baseBoq.id);
    expect(boq.title).toBe(baseBoq.title);
    expect(boq.currency).toBe(baseBoq.currency);
    expect(boq.contingency_pct).toBe(baseBoq.contingency_pct);
    expect(boq.vat_pct).toBe(baseBoq.vat_pct);
    expect(boq.client_notes).toBe(baseBoq.client_notes);
  });
});

describe("scrubBoqForExternalViewer — summary", () => {
  it("zeroes internal cost + margin aggregates", () => {
    const { summary } = scrubBoqForExternalViewer({
      boq: baseBoq,
      items: [],
      summary: baseSummary,
    });
    expect(summary.total_cost).toBe("0");
    expect(summary.average_margin_pct).toBe("0");
    expect(summary.margin_bleed_count).toBe(0);
    expect(summary.over_budget_count).toBe(0);
  });

  it("preserves client-facing financial totals", () => {
    const { summary } = scrubBoqForExternalViewer({
      boq: baseBoq,
      items: [],
      summary: baseSummary,
    });
    expect(summary.total_sell_price).toBe(baseSummary.total_sell_price);
    expect(summary.subtotal).toBe(baseSummary.subtotal);
    expect(summary.pre_vat_total).toBe(baseSummary.pre_vat_total);
    expect(summary.client_total).toBe(baseSummary.client_total);
    expect(summary.pending_approvals).toBe(baseSummary.pending_approvals);
    expect(summary.item_count).toBe(baseSummary.item_count);
  });

  it("zeroes per-section total_cost while keeping sell price + count", () => {
    const { summary } = scrubBoqForExternalViewer({
      boq: baseBoq,
      items: [],
      summary: baseSummary,
    });
    expect(summary.section_totals).toHaveLength(1);
    expect(summary.section_totals[0].total_cost).toBe("0");
    expect(summary.section_totals[0].total_sell_price).toBe(
      baseSummary.section_totals[0].total_sell_price
    );
    expect(summary.section_totals[0].section_id).toBe(
      baseSummary.section_totals[0].section_id
    );
    expect(summary.section_totals[0].item_count).toBe(
      baseSummary.section_totals[0].item_count
    );
  });
});
