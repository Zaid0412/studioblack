import ExcelJS from "exceljs";
import type { Element, ElementCategory } from "@/types";
import {
  TEMPLATE_COLUMN_LABELS,
  TEMPLATE_COLUMN_ORDER,
  buildCategoryPathById,
} from "./elementParser";

/**
 * Subset of `Element` fields actually emitted to the sheet. Lets callers
 * that don't have a full DB row (e.g. the import-template route) build a
 * minimal object without lying to the type-checker via `as Element`.
 */
export type WritableElement = Pick<
  Element,
  | "category_id"
  | "code"
  | "name"
  | "description"
  | "unit"
  | "unit_cost"
  | "currency"
  | "material_cost"
  | "labour_cost"
  | "overhead_pct"
  | "service_charge_pct"
  | "margin_pct"
  | "client_rate"
  | "budget_rate"
  | "spec_reference"
  | "drawing_ref"
  | "tags"
>;

/**
 * Write a set of elements to an .xlsx buffer using the same column layout
 * as the import template — round-trips cleanly through parseElementSheet.
 */
export async function writeElementSheet(
  elements: WritableElement[],
  categories: ElementCategory[]
): Promise<Buffer> {
  const pathById = buildCategoryPathById(categories);

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "StudioBlack";
  workbook.created = new Date();
  const ws = workbook.addWorksheet("Elements");

  ws.columns = TEMPLATE_COLUMN_ORDER.map((key) => ({
    header: TEMPLATE_COLUMN_LABELS[key],
    key,
    width: pickWidth(key),
    style: pickStyle(key),
  }));
  ws.getRow(1).font = { bold: true };

  for (const el of elements) {
    const categoryPath = el.category_id
      ? (pathById.get(el.category_id) ?? []).join(" > ")
      : "";
    ws.addRow({
      code: el.code,
      name: el.name,
      description: el.description ?? "",
      categoryPath,
      unit: el.unit,
      unitCost: toNumber(el.unit_cost),
      currency: el.currency,
      materialCost: toNumber(el.material_cost),
      labourCost: toNumber(el.labour_cost),
      overheadPct: toNumber(el.overhead_pct),
      serviceChargePct: toNumber(el.service_charge_pct),
      marginPct: toNumber(el.margin_pct),
      clientRate: toNumber(el.client_rate),
      budgetRate: toNumber(el.budget_rate),
      specReference: el.spec_reference ?? "",
      drawingRef: el.drawing_ref ?? "",
      tags: el.tags && el.tags.length > 0 ? el.tags.join(", ") : "",
    });
  }

  const buf = await workbook.xlsx.writeBuffer();
  return Buffer.from(buf);
}

/**
 * Coerce a numeric db string to a number. Returns null (not "") for missing
 * values so Excel treats the cell as blank-numeric — preserves Sum/Avg in the
 * status bar and keeps the round-trip on the fast numeric path.
 */
function toNumber(v: string | null | undefined): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function pickWidth(key: string): number {
  switch (key) {
    case "code":
      return 18;
    case "name":
    case "description":
    case "categoryPath":
      return 30;
    case "specReference":
    case "drawingRef":
    case "tags":
      return 22;
    default:
      return 14;
  }
}

/** Per-column Excel cell styling — adds money/percent numFmt. */
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
      // Stored as 0-100; render with a trailing % symbol without dividing.
      return { numFmt: "0.00\\%" };
    default:
      return undefined;
  }
}
