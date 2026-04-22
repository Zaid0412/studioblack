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
  /** 1-based index among data rows (header excluded). First data row is 1. */
  rowNumber: number;
  /** Literal Excel row index (header is row 1). Use this for user-facing messages. */
  excelRowNumber: number;
  raw: Record<string, unknown>;
  parsed: ParsedElementValues | null;
  status: "valid" | "error";
  errors: string[];
  /**
   * Non-fatal notes surfaced in the preview. Currently used to flag locale
   * decimal-comma ambiguity ("1,234" → 1.234 vs 1234) so the user can catch
   * a misparse before committing.
   */
  warnings: string[];
}

export interface ParseResult {
  headers: string[];
  unknownColumns: string[];
  missingColumns: string[];
  /** Template columns that appeared more than once — latest occurrence wins. */
  duplicateColumns: string[];
  rows: ParsedElementRow[];
  totalRows: number;
  /** True when the sheet was truncated by `MAX_DATA_ROWS`. */
  truncated?: boolean;
}

// ── Safety caps ──────────────────────────────────────────────────────────
// Defensive limits against decompression-bomb xlsx files. File-controlled
// bounds (columnCount, actualRowCount) must never drive tight loops uncapped.
const MAX_COLS = 64;
const MAX_DATA_ROWS = 10_000;

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
  // Strip BOM in addition to whitespace — some locales prepend U+FEFF.
  return s
    .replace(/^\uFEFF/, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

/**
 * Normalize a category path segment for lookup. Unlike headers, category
 * names are case-sensitive by design ("PVC" ≠ "Pvc"); we only trim and
 * collapse inner whitespace.
 */
export function normalizeCategorySegment(s: string): string {
  return s
    .replace(/^\uFEFF/, "")
    .trim()
    .replace(/\s+/g, " ");
}

// ── Category resolution ─────────────────────────────────────────────────────

/** Build a `"root > child > leaf"` → categoryId map for path lookup. */
export function buildCategoryPathMap(
  categories: Array<Pick<ElementCategory, "id" | "name" | "parent_id">>
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
    const key = parts.map(normalizeCategorySegment).join(" > ");
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
 * hyperlinks, formula results, dates, and formula-error cells (`{ error: "#DIV/0!" }`)
 * by returning their display text or an empty string.
 */
function cellText(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value.replace(/^\uFEFF/, "").trim();
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object") {
    const v = value as Record<string, unknown>;
    // ExcelJS formula-error cells. Treat as empty — caller re-reports as a
    // typed row error via the required-field check.
    if (typeof v.error === "string") return "";
    if (Array.isArray(v.richText)) {
      return v.richText
        .map((t) =>
          typeof t === "object" && t && "text" in t
            ? (t as { text: string }).text
            : ""
        )
        .join("")
        .trim();
    }
    if (typeof v.hyperlink === "string") {
      return typeof v.text === "string" ? String(v.text).trim() : "";
    }
    if (typeof v.text === "string") return v.text.trim();
    if (typeof v.result !== "undefined") return cellText(v.result);
  }
  return String(value).trim();
}

export interface CellNumberResult {
  value: number | null;
  /**
   * True when the text-path decimal heuristic fired on a 3-trailing-digit
   * single-comma input (e.g. `"1,234"`). The value is returned as decimal
   * (1.234) per the Turkey-market default, but the caller should surface
   * a row-level warning so the user can sanity-check the parse.
   */
  ambiguous: boolean;
}

/**
 * Parse a cell value to a number, with locale heuristics for TR/EU decimal
 * formatting. Excel-sourced numbers hit the `typeof number` fast-path; only
 * text-typed cells exercise the locale branch.
 *
 * Rules (text path):
 *   - `"1.234,56"` → `1234.56` (comma is decimal when it appears last)
 *   - `"1,234.56"` → `1234.56` (dot is decimal when it appears last)
 *   - `"1,5"` → `1.5` (single comma, 1–3 trailing digits → decimal)
 *   - `"1,234"` with 3 trailing digits ambiguous — treated as decimal per
 *     the Turkey-market default, and flagged via `ambiguous: true` so the
 *     caller can emit a preview warning. Excel-native cells avoid this path.
 */
function cellNumber(value: unknown): CellNumberResult {
  if (value === null || value === undefined || value === "")
    return { value: null, ambiguous: false };
  if (typeof value === "number" && Number.isFinite(value))
    return { value, ambiguous: false };
  const text = cellText(value);
  if (text === "") return { value: null, ambiguous: false };

  const cleaned = text.replace(/\s/g, "");
  const hasComma = cleaned.includes(",");
  const hasDot = cleaned.includes(".");
  let normalized = cleaned;
  let ambiguous = false;

  if (hasComma && hasDot) {
    const lastComma = cleaned.lastIndexOf(",");
    const lastDot = cleaned.lastIndexOf(".");
    if (lastComma > lastDot) {
      normalized = cleaned.replace(/\./g, "").replace(",", ".");
    } else {
      normalized = cleaned.replace(/,/g, "");
    }
  } else if (hasComma) {
    const parts = cleaned.split(",");
    const onlyOneComma = parts.length === 2;
    const trailing = onlyOneComma ? parts[1] : "";
    const leading = onlyOneComma ? parts[0] : "";
    const looksDecimal =
      onlyOneComma && /^\d{1,3}$/.test(trailing) && /^-?\d+$/.test(leading);
    if (looksDecimal) {
      normalized = `${leading}.${trailing}`;
      // "1,234" could be thousands-separator (1234) or decimal (1.234);
      // flag the caller so the preview can ask for confirmation.
      if (trailing.length === 3) ambiguous = true;
    } else {
      normalized = cleaned.replace(/,/g, "");
    }
  }

  const n = Number(normalized);
  return { value: Number.isFinite(n) ? n : null, ambiguous };
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
      duplicateColumns: [],
      rows: [],
      totalRows: 0,
    };
  }

  const headerRow = worksheet.getRow(1);
  const headerValues: string[] = [];
  // Clamp file-controlled loop bounds to defensive caps.
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

  // Track duplicate template-key columns (two "Code" headers → the latter wins).
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
        TEMPLATE_COLUMN_ORDER.indexOf(a) - TEMPLATE_COLUMN_ORDER.indexOf(b)
    )
    .map((k) => TEMPLATE_COLUMNS[k]);
  const duplicateColumns = [...duplicateKeys]
    .sort(
      (a, b) =>
        TEMPLATE_COLUMN_ORDER.indexOf(a) - TEMPLATE_COLUMN_ORDER.indexOf(b)
    )
    .map((k) => TEMPLATE_COLUMNS[k]);

  const pathMap = buildCategoryPathMap(categories);
  const rows: ParsedElementRow[] = [];
  // Case-sensitive: the DB `element.code` column is VARCHAR (not CITEXT)
  // and uniqueness is enforced at the app layer against the exact literal,
  // so "A-01" and "a-01" are distinct codes end-to-end.
  const seenCodes = new Map<string, number>();

  const lastRow = Math.min(worksheet.actualRowCount, MAX_DATA_ROWS + 1);
  const truncated = worksheet.actualRowCount > MAX_DATA_ROWS + 1;
  let dataRowIndex = 0;
  for (let r = 2; r <= lastRow; r++) {
    const excelRow = worksheet.getRow(r);
    if (!excelRow || excelRow.cellCount === 0) continue;
    dataRowIndex += 1;

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
    if (!anyCell) {
      dataRowIndex -= 1;
      continue;
    }

    const errors: string[] = [];
    const warnings: string[] = [];
    const values: Partial<ParsedElementValues> = { rowNumber: dataRowIndex };

    // ── Required strings
    if (byKey.code === undefined || byKey.code === "") {
      errors.push("Code is required");
    } else if (byKey.code.length > 50) {
      errors.push("Code must be 50 characters or fewer");
    } else {
      values.code = byKey.code;
    }

    if (byKey.name === undefined || byKey.name === "") {
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

    const noteAmbiguous = (label: string, raw: string, parsed: number) => {
      warnings.push(
        `${label} "${raw}" is ambiguous — parsed as ${parsed}. Edit the sheet if this is wrong.`
      );
    };

    // ── Unit cost
    const unitCostResult = cellNumber(byKey.unitCost);
    if (unitCostResult.value === null) {
      errors.push("Unit Cost is required");
    } else if (unitCostResult.value < 0) {
      errors.push("Unit Cost must be zero or positive");
    } else {
      values.unitCost = unitCostResult.value;
      if (unitCostResult.ambiguous)
        noteAmbiguous("Unit Cost", byKey.unitCost ?? "", unitCostResult.value);
    }

    // ── Optional numerics
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

    // ── Optional strings
    if (byKey.description) {
      if (byKey.description.length > 2000) {
        errors.push("Description must be 2000 characters or fewer");
      } else values.description = byKey.description;
    }
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
      const rawSegments = byKey.categoryPath.split(">").map((s) => s.trim());
      const hasEmptySegment = rawSegments.some((s) => s.length === 0);
      if (rawSegments.length === 0 || hasEmptySegment) {
        errors.push(
          "Category Path has empty segments — use 'A > B > C' with non-empty labels"
        );
      } else {
        const lookupKey = rawSegments.map(normalizeCategorySegment).join(" > ");
        if (!pathMap.has(lookupKey)) {
          errors.push(
            `Category path "${rawSegments.join(" > ")}" not found in this org`
          );
        } else {
          values.categoryPath = rawSegments;
        }
      }
    }

    // ── Duplicate code within the sheet
    if (values.code) {
      const firstSeen = seenCodes.get(values.code);
      if (firstSeen !== undefined) {
        errors.push(`Duplicate code in sheet — first seen on row ${firstSeen}`);
      } else {
        seenCodes.set(values.code, dataRowIndex);
      }
    }

    const hasErrors = errors.length > 0;
    rows.push({
      rowNumber: dataRowIndex,
      excelRowNumber: r,
      raw,
      parsed: hasErrors ? null : (values as ParsedElementValues),
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
