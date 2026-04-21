import ExcelJS from "exceljs";
import type { ElementCategory } from "@/types";
import { ALLOWED_UNITS, type ElementUnit } from "@/lib/validations";

/**
 * Parsed values for one row. Shape aligns with `importElementRowSchema` so the
 * server can re-validate on confirm without any remapping.
 */
export interface ParsedElementValues {
  rowNumber: number;
  code: string;
  name: string;
  description?: string;
  categoryPath?: string[];
  unit: ElementUnit;
  unitCost: number;
  currency?: string;
  materialCost?: number;
  labourCost?: number;
  overheadPct?: number;
  marginPct?: number;
  specReference?: string;
  drawingRef?: string;
  tags?: string[];
}

export interface ParsedElementRow {
  /** 1-based, matches the Excel row number (header = row 1). */
  rowNumber: number;
  raw: Record<string, unknown>;
  parsed: ParsedElementValues | null;
  status: "valid" | "error";
  errors: string[];
}

export interface ParseResult {
  headers: string[];
  unknownColumns: string[];
  missingColumns: string[];
  rows: ParsedElementRow[];
  totalRows: number;
}

// ── Template definition ─────────────────────────────────────────────────────

const TEMPLATE_COLUMNS = {
  code: "Code",
  name: "Name",
  description: "Description",
  categoryPath: "Category Path",
  unit: "Unit",
  unitCost: "Unit Cost",
  currency: "Currency",
  materialCost: "Material Cost",
  labourCost: "Labour Cost",
  overheadPct: "Overhead %",
  marginPct: "Margin %",
  specReference: "Spec Reference",
  drawingRef: "Drawing Ref",
  tags: "Tags",
} as const;

type TemplateKey = keyof typeof TEMPLATE_COLUMNS;

const REQUIRED_COLUMNS: TemplateKey[] = ["code", "name", "unit", "unitCost"];

/** Case-insensitive lookup from normalized header label → template key. */
const HEADER_TO_KEY: Map<string, TemplateKey> = new Map(
  (Object.entries(TEMPLATE_COLUMNS) as [TemplateKey, string][]).map(
    ([k, label]) => [normalizeHeader(label), k]
  )
);

export const TEMPLATE_COLUMN_LABELS: Record<TemplateKey, string> =
  TEMPLATE_COLUMNS;
export const TEMPLATE_COLUMN_ORDER: TemplateKey[] = Object.keys(
  TEMPLATE_COLUMNS
) as TemplateKey[];

function normalizeHeader(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

// ── Category resolution ─────────────────────────────────────────────────────

/** Build a `"root > child > leaf"` → categoryId map for path lookup. */
export function buildCategoryPathMap(
  categories: ElementCategory[]
): Map<string, string> {
  const byId = new Map(categories.map((c) => [c.id, c]));
  const map = new Map<string, string>();
  for (const cat of categories) {
    const parts: string[] = [cat.name];
    let parentId = cat.parent_id;
    while (parentId) {
      const parent = byId.get(parentId);
      if (!parent) break;
      parts.unshift(parent.name);
      parentId = parent.parent_id;
    }
    const key = parts.map(normalizeHeader).join(" > ");
    map.set(key, cat.id);
  }
  return map;
}

/** Inverse map: categoryId → `["root", "child", "leaf"]` for the export writer. */
export function buildCategoryPathById(
  categories: ElementCategory[]
): Map<string, string[]> {
  const byId = new Map(categories.map((c) => [c.id, c]));
  const map = new Map<string, string[]>();
  for (const cat of categories) {
    const parts: string[] = [cat.name];
    let parentId = cat.parent_id;
    while (parentId) {
      const parent = byId.get(parentId);
      if (!parent) break;
      parts.unshift(parent.name);
      parentId = parent.parent_id;
    }
    map.set(cat.id, parts);
  }
  return map;
}

// ── Cell coercion ───────────────────────────────────────────────────────────

/**
 * Flatten an exceljs cell value to a primitive. Handles rich text objects,
 * hyperlinks, formula results, and dates by returning their display text.
 */
function cellText(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object") {
    const v = value as Record<string, unknown>;
    if (typeof v.text === "string") return v.text.trim();
    if (typeof v.result !== "undefined") return cellText(v.result);
    if (Array.isArray(v.richText)) {
      return v.richText
        .map((t) => (typeof t === "object" && t && "text" in t ? (t as { text: string }).text : ""))
        .join("")
        .trim();
    }
    if (typeof v.hyperlink === "string") {
      return typeof v.text === "string" ? String(v.text).trim() : "";
    }
  }
  return String(value).trim();
}

function cellNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const text = cellText(value);
  if (text === "") return null;
  const n = Number(text.replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}

// ── Parse ───────────────────────────────────────────────────────────────────

/**
 * Parse an uploaded .xlsx buffer into a preview-ready {@link ParseResult}.
 * Resolves category paths against the org's category tree and flags duplicate
 * codes within the sheet. No DB writes — safe to call in a request handler.
 */
export async function parseElementSheet(
  buffer: Buffer,
  categories: ElementCategory[]
): Promise<ParseResult> {
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
      rows: [],
      totalRows: 0,
    };
  }

  const headerRow = worksheet.getRow(1);
  const headerValues: string[] = [];
  // exceljs row.values[0] is always undefined (1-indexed), so iterate getCell.
  const columnCount = worksheet.columnCount || headerRow.cellCount || 0;
  for (let c = 1; c <= columnCount; c++) {
    headerValues.push(cellText(headerRow.getCell(c).value));
  }

  const headerKeys: (TemplateKey | null)[] = headerValues.map((h) => {
    if (!h) return null;
    return HEADER_TO_KEY.get(normalizeHeader(h)) ?? null;
  });

  const seenKeys = new Set<TemplateKey>();
  headerKeys.forEach((k) => {
    if (k) seenKeys.add(k);
  });

  const unknownColumns = headerValues.filter(
    (h, i) => h && headerKeys[i] === null
  );
  const missingColumns = REQUIRED_COLUMNS.filter((k) => !seenKeys.has(k)).map(
    (k) => TEMPLATE_COLUMNS[k]
  );

  const pathMap = buildCategoryPathMap(categories);
  const rows: ParsedElementRow[] = [];
  const seenCodes = new Map<string, number>(); // normalized code → first rowNumber seen

  const lastRow = worksheet.actualRowCount;
  for (let r = 2; r <= lastRow; r++) {
    const excelRow = worksheet.getRow(r);
    if (!excelRow || excelRow.cellCount === 0) continue;

    // Collect raw values keyed by header label so the UI can render the preview.
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
    const values: Partial<ParsedElementValues> = { rowNumber: r };

    // ── Required strings
    if (!byKey.code) {
      errors.push("Code is required");
    } else if (byKey.code.length > 50) {
      errors.push("Code must be 50 characters or fewer");
    } else {
      values.code = byKey.code;
    }

    if (!byKey.name) {
      errors.push("Name is required");
    } else if (byKey.name.length > 255) {
      errors.push("Name must be 255 characters or fewer");
    } else {
      values.name = byKey.name;
    }

    // ── Unit
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

    // ── Unit cost
    const unitCost = cellNumber(byKey.unitCost);
    if (unitCost === null) {
      errors.push("Unit Cost is required");
    } else if (unitCost < 0) {
      errors.push("Unit Cost must be zero or positive");
    } else {
      values.unitCost = unitCost;
    }

    // ── Optional numerics
    for (const [k, label] of [
      ["materialCost", "Material Cost"],
      ["labourCost", "Labour Cost"],
    ] as const) {
      const v = byKey[k];
      if (v) {
        const n = cellNumber(v);
        if (n === null) errors.push(`${label} must be a number`);
        else if (n < 0) errors.push(`${label} must be zero or positive`);
        else values[k] = n;
      }
    }
    for (const [k, label] of [
      ["overheadPct", "Overhead %"],
      ["marginPct", "Margin %"],
    ] as const) {
      const v = byKey[k];
      if (v) {
        const n = cellNumber(v);
        if (n === null) errors.push(`${label} must be a number`);
        else if (n < 0 || n > 100)
          errors.push(`${label} must be between 0 and 100`);
        else values[k] = n;
      }
    }

    // ── Optional strings
    if (byKey.description) values.description = byKey.description;
    if (byKey.specReference) {
      if (byKey.specReference.length > 255) {
        errors.push("Spec Reference must be 255 characters or fewer");
      } else values.specReference = byKey.specReference;
    }
    if (byKey.drawingRef) {
      if (byKey.drawingRef.length > 255) {
        errors.push("Drawing Ref must be 255 characters or fewer");
      } else values.drawingRef = byKey.drawingRef;
    }

    // ── Currency
    if (byKey.currency) {
      const cur = byKey.currency.trim().toUpperCase();
      if (cur.length !== 3) {
        errors.push("Currency must be a 3-letter code (e.g. USD, EUR, TRY)");
      } else values.currency = cur;
    }

    // ── Tags (comma-separated)
    if (byKey.tags) {
      const tags = byKey.tags
        .split(",")
        .map((t) => t.trim())
        .filter((t) => t.length > 0);
      if (tags.length > 0) values.tags = tags;
    }

    // ── Category path
    if (byKey.categoryPath) {
      const segments = byKey.categoryPath
        .split(">")
        .map((s) => s.trim())
        .filter((s) => s.length > 0);
      if (segments.length === 0) {
        errors.push("Category Path cannot be empty if provided");
      } else {
        const normalizedKey = segments.map(normalizeHeader).join(" > ");
        if (!pathMap.has(normalizedKey)) {
          errors.push(
            `Category path "${segments.join(" > ")}" not found in this org`
          );
        } else {
          values.categoryPath = segments;
        }
      }
    }

    // ── Duplicate code within the sheet
    if (values.code) {
      const key = values.code.toLowerCase();
      const firstSeen = seenCodes.get(key);
      if (firstSeen !== undefined) {
        errors.push(
          `Duplicate code in sheet — first seen on row ${firstSeen}`
        );
      } else {
        seenCodes.set(key, r);
      }
    }

    const hasErrors = errors.length > 0;
    rows.push({
      rowNumber: r,
      raw,
      parsed: hasErrors ? null : (values as ParsedElementValues),
      status: hasErrors ? "error" : "valid",
      errors,
    });
  }

  return {
    headers: headerValues.filter((h) => h),
    unknownColumns,
    missingColumns,
    rows,
    totalRows: rows.length,
  };
}
