import ExcelJS from "exceljs";
import type { Element, ElementCategory } from "@/types";
import {
  TEMPLATE_COLUMN_LABELS,
  TEMPLATE_COLUMN_ORDER,
  buildCategoryPathById,
} from "./elementParser";

/**
 * Write a set of elements to an .xlsx buffer using the same column layout
 * as the import template — round-trips cleanly through parseElementSheet.
 */
export async function writeElementSheet(
  elements: Element[],
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
      marginPct: toNumber(el.margin_pct),
      specReference: el.spec_reference ?? "",
      drawingRef: el.drawing_ref ?? "",
      tags: el.tags && el.tags.length > 0 ? el.tags.join(", ") : "",
    });
  }

  const buf = await workbook.xlsx.writeBuffer();
  return Buffer.from(buf);
}

function toNumber(v: string | null | undefined): number | "" {
  if (v === null || v === undefined || v === "") return "";
  const n = Number(v);
  return Number.isFinite(n) ? n : "";
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
