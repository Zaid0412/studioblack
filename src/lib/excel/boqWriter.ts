import ExcelJS from "exceljs";
import type { BoqItemWithComputed, BoqSection } from "@/types";
import {
  BOQ_TEMPLATE_COLUMN_LABELS,
  BOQ_TEMPLATE_COLUMN_ORDER,
} from "./boqParser";

export interface BoqExportInput {
  items: BoqItemWithComputed[];
  sections: BoqSection[];
}

/**
 * Write a BOQ to an .xlsx buffer using the same column layout as the import
 * template — round-trips cleanly through parseBoqSheet. Computed cost columns
 * (sell_price, subtotal, total_cost) are intentionally omitted so the export
 * can be edited and re-imported without column mismatch.
 *
 * Takes the minimal `{ items, sections }` shape — no need to load BOQ
 * summary aggregates that the writer doesn't render.
 */
export async function writeBoqSheet(boq: BoqExportInput): Promise<Buffer> {
  const sectionById = new Map(boq.sections.map((s) => [s.id, s]));

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "StudioBlack";
  workbook.created = new Date();
  const ws = workbook.addWorksheet("BOQ");

  ws.columns = BOQ_TEMPLATE_COLUMN_ORDER.map((key) => ({
    header: BOQ_TEMPLATE_COLUMN_LABELS[key],
    key,
    width: pickWidth(key),
    style: pickStyle(key),
  }));
  ws.getRow(1).font = { bold: true };

  for (const item of boq.items) {
    const section = item.section_id ? sectionById.get(item.section_id) : null;
    ws.addRow({
      sectionTitle: section?.title ?? "",
      itemCode: item.item_code,
      description: item.description,
      unit: item.unit,
      quantity: toNumber(item.quantity),
      unitCost: toNumber(item.unit_cost),
      materialCost: toNumber(item.material_cost),
      labourCost: toNumber(item.labour_cost),
      overheadPct: toNumber(item.overhead_pct),
      serviceChargePct: toNumber(item.service_charge_pct),
      marginPct: toNumber(item.margin_pct),
      clientRate: toNumber(item.client_rate),
      budgetRate: toNumber(item.budget_rate),
      length: toNumber(item.length),
      breadth: toNumber(item.breadth),
      height: toNumber(item.height),
      notes: item.notes ?? "",
      clientNotes: item.client_notes ?? "",
      isProvisional: item.is_provisional ? "yes" : "",
    });
  }

  const buf = await workbook.xlsx.writeBuffer();
  return Buffer.from(buf);
}

/** Coerce a numeric db string to a number (null → blank cell). */
function toNumber(v: string | null | undefined): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function pickWidth(key: string): number {
  switch (key) {
    case "sectionTitle":
    case "description":
      return 32;
    case "itemCode":
      return 16;
    case "notes":
    case "clientNotes":
      return 24;
    default:
      return 14;
  }
}

function pickStyle(key: string): Partial<ExcelJS.Style> | undefined {
  switch (key) {
    case "unitCost":
    case "materialCost":
    case "labourCost":
    case "clientRate":
    case "budgetRate":
      return { numFmt: "#,##0.00" };
    case "overheadPct":
    case "serviceChargePct":
    case "marginPct":
      return { numFmt: "0.00\\%" };
    case "quantity":
    case "length":
    case "breadth":
    case "height":
      return { numFmt: "#,##0.000" };
    default:
      return undefined;
  }
}
