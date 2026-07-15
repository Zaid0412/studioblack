import ExcelJS from "exceljs";
import type { ElementCategoryNode } from "@/types";
import { codeSegmentOf } from "@/lib/categoryCode";
import {
  CATEGORY_TEMPLATE_COLUMNS,
  CATEGORY_TEMPLATE_ORDER,
} from "./categoryParser";

/**
 * One sheet row: a full Category › Sub-category › Service Area path, with each
 * rung's code *segment* rather than its composed path code. The segment is what
 * the user edits — `BASE`, not `KIT-CAB-BASE` — and the importer composes the
 * rest, so a re-parented branch recodes itself for free.
 */
interface SheetRow {
  category: string;
  categoryCode: string;
  subcategory: string;
  subcategoryCode: string;
  serviceArea: string;
  serviceAreaCode: string;
}

/**
 * Flatten the tree to one row per leaf — a Service Area, or the branch's last
 * node where it stops short of one.
 *
 * A childless node still gets a row. It has to: the sheet is round-tripped
 * (export, edit one cell, import), and a node the export can't express would be
 * absent from the re-import, where the diff would read it as a deletion.
 */
export function categoryRows(tree: ElementCategoryNode[]): SheetRow[] {
  const rows: SheetRow[] = [];

  for (const category of tree) {
    const categoryCode = category.code_prefix ?? "";

    if (category.children.length === 0) {
      rows.push({
        category: category.name,
        categoryCode,
        subcategory: "",
        subcategoryCode: "",
        serviceArea: "",
        serviceAreaCode: "",
      });
      continue;
    }

    for (const sub of category.children) {
      const subCode = sub.code_prefix ?? "";
      const subSegment = codeSegmentOf(subCode, categoryCode || null);

      if (sub.children.length === 0) {
        rows.push({
          category: category.name,
          categoryCode,
          subcategory: sub.name,
          subcategoryCode: subSegment,
          serviceArea: "",
          serviceAreaCode: "",
        });
        continue;
      }

      for (const area of sub.children) {
        rows.push({
          category: category.name,
          categoryCode,
          subcategory: sub.name,
          subcategoryCode: subSegment,
          serviceArea: area.name,
          serviceAreaCode: codeSegmentOf(
            area.code_prefix ?? "",
            subCode || null
          ),
        });
      }
    }
  }

  return rows;
}

/**
 * Write the taxonomy as an .xlsx. Used for the blank template and for exporting
 * the live tree, so what you download is exactly what the importer accepts —
 * edit a cell, upload it back, and the diff is the edit you made.
 */
export async function writeCategorySheet(
  tree: ElementCategoryNode[]
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Categories");

  sheet.columns = CATEGORY_TEMPLATE_ORDER.map((key) => ({
    header: CATEGORY_TEMPLATE_COLUMNS[key],
    key,
    width: key.endsWith("Code") ? 18 : 28,
  }));
  sheet.getRow(1).font = { bold: true };

  for (const row of categoryRows(tree)) sheet.addRow(row);

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
