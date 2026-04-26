import ExcelJS from "exceljs";
import type {
  BoqElementLite,
  BoqParseResult,
  ParsedBoqRow,
  ParsedBoqValues,
} from "@/types";
import { ALLOWED_UNITS, type ElementUnit } from "@/lib/validations";
import {
  MAX_COLS,
  cellBool,
  cellNumber,
  cellText,
  normalizeHeader,
} from "./_shared";

// ── Safety caps ──────────────────────────────────────────────────────────
// `MAX_COLS` is shared with the element parser via `_shared.ts`. The BOQ
// row cap is intentionally aligned with `boqImportConfirmSchema.rows.max(5_000)`
// in validations.ts — bumping one without the other silently truncates at
// the confirm step.
const MAX_DATA_ROWS = 5_000;

// ── Template definition ─────────────────────────────────────────────────────

const TEMPLATE_COLUMNS = {
  sectionTitle: "Section",
  itemCode: "Item Code",
  description: "Description",
  unit: "Unit",
  quantity: "Quantity",
  unitCost: "Unit Cost",
  materialCost: "Material Cost",
  labourCost: "Labour Cost",
  overheadPct: "Overhead %",
  marginPct: "Margin %",
  notes: "Notes",
  clientNotes: "Client Notes",
  isProvisional: "Is Provisional",
} as const;

type TemplateKey = keyof typeof TEMPLATE_COLUMNS;

const REQUIRED_COLUMNS: TemplateKey[] = [
  "description",
  "unit",
  "quantity",
  "unitCost",
];

/** Case-insensitive lookup from normalized header label → template key. */
const HEADER_TO_KEY: Map<string, TemplateKey> = new Map(
  (Object.entries(TEMPLATE_COLUMNS) as [TemplateKey, string][]).map(
    ([k, label]) => [normalizeHeader(label), k]
  )
);

export const BOQ_TEMPLATE_COLUMN_LABELS: Record<TemplateKey, string> =
  TEMPLATE_COLUMNS;
export const BOQ_TEMPLATE_COLUMN_ORDER: TemplateKey[] = Object.keys(
  TEMPLATE_COLUMNS
) as TemplateKey[];

// ── Parse ───────────────────────────────────────────────────────────────────

/**
 * Parse an uploaded .xlsx buffer into a preview-ready {@link BoqParseResult}.
 * Resolves element links against the caller-provided `elementsByCode` map.
 * No DB writes — safe to call in a request handler.
 */
export async function parseBoqSheet(
  buffer: Buffer,
  elementsByCode: Map<string, BoqElementLite>
): Promise<BoqParseResult> {
  const workbook = new ExcelJS.Workbook();
  // Type cast: @types/node v24 made Buffer generic over ArrayBufferLike, but
  // exceljs's d.ts still declares the legacy Buffer shape. Runtime is fine.
  await workbook.xlsx.load(
    buffer as unknown as Parameters<typeof workbook.xlsx.load>[0]
  );
  const worksheet = workbook.worksheets[0];
  if (!worksheet) {
    return {
      headers: [],
      unknownColumns: [],
      missingColumns: REQUIRED_COLUMNS.map((k) => TEMPLATE_COLUMNS[k]),
      duplicateColumns: [],
      rows: [],
      totalRows: 0,
    };
  }

  const headerRow = worksheet.getRow(1);
  const headerValues: string[] = [];
  const columnCount = Math.min(
    worksheet.columnCount || headerRow.cellCount || 0,
    MAX_COLS
  );
  for (let c = 1; c <= columnCount; c++) {
    headerValues.push(cellText(headerRow.getCell(c).value));
  }

  const headerKeys: (TemplateKey | null)[] = headerValues.map((h) => {
    if (!h) return null;
    return HEADER_TO_KEY.get(normalizeHeader(h)) ?? null;
  });

  const seenKeys = new Set<TemplateKey>();
  const duplicateKeys = new Set<TemplateKey>();
  headerKeys.forEach((k) => {
    if (!k) return;
    if (seenKeys.has(k)) duplicateKeys.add(k);
    else seenKeys.add(k);
  });

  const unknownColumns = headerValues.filter(
    (h, i) => h && headerKeys[i] === null
  );
  const missingColumns = REQUIRED_COLUMNS.filter((k) => !seenKeys.has(k))
    .sort(
      (a, b) =>
        BOQ_TEMPLATE_COLUMN_ORDER.indexOf(a) -
        BOQ_TEMPLATE_COLUMN_ORDER.indexOf(b)
    )
    .map((k) => TEMPLATE_COLUMNS[k]);
  const duplicateColumns = [...duplicateKeys]
    .sort(
      (a, b) =>
        BOQ_TEMPLATE_COLUMN_ORDER.indexOf(a) -
        BOQ_TEMPLATE_COLUMN_ORDER.indexOf(b)
    )
    .map((k) => TEMPLATE_COLUMNS[k]);

  const rows: ParsedBoqRow[] = [];
  const lastRow = Math.min(worksheet.actualRowCount, MAX_DATA_ROWS + 1);
  const truncated = worksheet.actualRowCount > MAX_DATA_ROWS + 1;

  for (let r = 2; r <= lastRow; r++) {
    const excelRow = worksheet.getRow(r);
    if (!excelRow || excelRow.cellCount === 0) continue;

    const raw: Record<string, unknown> = {};
    const byKey: Partial<Record<TemplateKey, string>> = {};
    let anyCell = false;
    for (let c = 1; c <= columnCount; c++) {
      const label = headerValues[c - 1];
      if (!label) continue;
      const text = cellText(excelRow.getCell(c).value);
      if (text !== "") anyCell = true;
      raw[label] = text;
      const key = headerKeys[c - 1];
      if (key) byKey[key] = text;
    }
    if (!anyCell) continue;

    const errors: string[] = [];
    const warnings: string[] = [];
    // `rowNumber` carries the literal Excel row index throughout — the
    // server's `failed[].rowNumber` matches what the user sees in the sheet
    // and in the preview, regardless of blank rows above.
    const values: Partial<ParsedBoqValues> = { rowNumber: r };

    // ── Description (required)
    if (!byKey.description) {
      errors.push("Description is required");
    } else if (byKey.description.length > 2000) {
      errors.push("Description must be 2000 characters or fewer");
    } else {
      values.description = byKey.description;
    }

    // ── Unit (required, enum)
    const rawUnit = (byKey.unit ?? "").toLowerCase();
    if (!rawUnit) {
      errors.push("Unit is required");
    } else if (!ALLOWED_UNITS.includes(rawUnit as ElementUnit)) {
      errors.push(
        `Unit "${byKey.unit}" is not allowed (must be one of: ${ALLOWED_UNITS.join(", ")})`
      );
    } else {
      values.unit = rawUnit as ElementUnit;
    }

    const noteAmbiguous = (label: string, rawText: string, parsed: number) => {
      warnings.push(
        `${label} "${rawText}" is ambiguous — parsed as ${parsed}. Edit the sheet if this is wrong.`
      );
    };

    // ── Quantity (required, non-negative)
    const qtyRes = cellNumber(byKey.quantity);
    if (qtyRes.value === null) {
      errors.push("Quantity is required");
    } else if (qtyRes.value < 0) {
      errors.push("Quantity must be zero or positive");
    } else {
      values.quantity = qtyRes.value;
      if (qtyRes.ambiguous)
        noteAmbiguous("Quantity", byKey.quantity ?? "", qtyRes.value);
    }

    // ── Unit Cost (required, non-negative)
    const unitCostRes = cellNumber(byKey.unitCost);
    if (unitCostRes.value === null) {
      errors.push("Unit Cost is required");
    } else if (unitCostRes.value < 0) {
      errors.push("Unit Cost must be zero or positive");
    } else {
      values.unitCost = unitCostRes.value;
      if (unitCostRes.ambiguous)
        noteAmbiguous("Unit Cost", byKey.unitCost ?? "", unitCostRes.value);
    }

    // ── Optional monetary numerics
    for (const [k, label] of [
      ["materialCost", "Material Cost"],
      ["labourCost", "Labour Cost"],
    ] as const) {
      const v = byKey[k];
      if (v !== undefined && v !== "") {
        const res = cellNumber(v);
        if (res.value === null) errors.push(`${label} must be a number`);
        else if (res.value < 0)
          errors.push(`${label} must be zero or positive`);
        else {
          values[k] = res.value;
          if (res.ambiguous) noteAmbiguous(label, v, res.value);
        }
      }
    }

    // ── Optional percentages (0–100)
    for (const [k, label] of [
      ["overheadPct", "Overhead %"],
      ["marginPct", "Margin %"],
    ] as const) {
      const v = byKey[k];
      if (v !== undefined && v !== "") {
        const res = cellNumber(v);
        if (res.value === null) errors.push(`${label} must be a number`);
        else if (res.value < 0 || res.value > 100)
          errors.push(`${label} must be between 0 and 100`);
        else {
          values[k] = res.value;
          if (res.ambiguous) noteAmbiguous(label, v, res.value);
        }
      }
    }

    // ── Optional strings with caps
    for (const [k, label, max] of [
      ["sectionTitle", "Section", 255],
      ["itemCode", "Item Code", 50],
      ["notes", "Notes", 2000],
      ["clientNotes", "Client Notes", 2000],
    ] as const) {
      const v = byKey[k];
      if (v) {
        if (v.length > max)
          errors.push(`${label} must be ${max} characters or fewer`);
        else values[k] = v;
      }
    }

    // ── Is Provisional (optional, lenient boolean parse)
    if (byKey.isProvisional !== undefined && byKey.isProvisional !== "") {
      const parsedBool = cellBool(byKey.isProvisional);
      if (parsedBool === undefined) {
        errors.push(
          `Is Provisional "${byKey.isProvisional}" is not a yes/no value`
        );
      } else {
        values.isProvisional = parsedBool;
      }
    }

    // ── Resolve element link (preview-only hint — not an error if missing)
    let linkedElement: BoqElementLite | undefined;
    if (values.itemCode) {
      linkedElement = elementsByCode.get(values.itemCode);
    }

    const hasErrors = errors.length > 0;
    rows.push({
      rowNumber: r,
      excelRowNumber: r,
      // `raw` is only consumed in the dialog as a fallback when `parsed` is
      // null (error rows). Drop it on clean rows so a 5,000-row sheet
      // doesn't ship 5,000 × 13-column raw maps back to the client.
      raw: hasErrors ? raw : {},
      parsed: hasErrors ? null : (values as ParsedBoqValues),
      linkedElement,
      status: hasErrors ? "error" : "valid",
      errors,
      warnings,
    });
  }

  return {
    headers: headerValues.filter((h) => h),
    unknownColumns,
    missingColumns,
    duplicateColumns,
    rows,
    totalRows: rows.length,
    truncated,
  };
}
