/**
 * Shared cell-coercion primitives for the xlsx parsers (F3 elements, F6 BOQ).
 *
 * Locale heuristics (decimal-comma vs. thousands-separator) live here so a
 * fix lands in every importer. The parsers themselves only handle template
 * shape and per-row validation.
 */

import ExcelJS from "exceljs";

// ── Safety caps ────────────────────────────────────────────────────────────
/** Hard cap on columns scanned per sheet — guards against bombs. */
export const MAX_COLS = 64;

// ── Header normalisation ────────────────────────────────────────────────────

/**
 * Lower-case + collapse whitespace + strip BOM. Used to map header-row
 * labels to internal template keys regardless of casing or trailing space.
 */
export function normalizeHeader(s: string): string {
  return s
    .replace(/^\uFEFF/, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

// ── Cell coercion ───────────────────────────────────────────────────────────

/**
 * Flatten an exceljs cell value to a primitive. Handles rich text, hyperlinks,
 * formula results, dates, and formula-error cells (`{ error: "#DIV/0!" }`)
 * by returning their display text or an empty string.
 */
export function cellText(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value.replace(/^\uFEFF/, "").trim();
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object") {
    const v = value as Record<string, unknown>;
    // ExcelJS formula-error cells. Treat as empty — the parser re-reports
    // the missing value via its required-field check.
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
   * single-comma input (e.g. `"1,234"`). The value is returned as a decimal
   * (1.234) per the Turkey-market default; the caller surfaces a row-level
   * warning so the user can sanity-check the parse.
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
 *   - `"1,5"`     → `1.5` (single comma, 1–3 trailing digits → decimal)
 *   - `"1,234"`   → `1.234` (ambiguous; flagged via `ambiguous: true`)
 */
export function cellNumber(value: unknown): CellNumberResult {
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
      // flag so the caller can ask the user to confirm.
      if (trailing.length === 3) ambiguous = true;
    } else {
      normalized = cleaned.replace(/,/g, "");
    }
  }

  const n = Number(normalized);
  return { value: Number.isFinite(n) ? n : null, ambiguous };
}

/**
 * Coerce a cell to a tristate boolean. Accepts true/false/yes/no/y/n/1/0
 * (case-insensitive). Returns undefined for empty/unknown — caller decides
 * if that's an error.
 */
export function cellBool(value: unknown): boolean | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value === "boolean") return value;
  const text = cellText(value).toLowerCase();
  if (["true", "yes", "y", "1"].includes(text)) return true;
  if (["false", "no", "n", "0"].includes(text)) return false;
  return undefined;
}

// ── Sheet loading + header resolution ────────────────────────────────────

export interface TemplateConfig<TKey extends string> {
  columns: Record<TKey, string>;
  required: readonly TKey[];
  order: readonly TKey[];
  /**
   * Optional pre-computed normalized-label → key map. Built from `columns`
   * if not supplied; pass it for sheets parsed in a hot loop to skip the
   * per-call rebuild.
   */
  headerToKey?: Map<string, TKey>;
}

export interface HeaderResolution<TKey extends string> {
  headerValues: string[];
  /** Resolved template key (or `null`) per column, indexed 0-based. */
  headerKeys: (TKey | null)[];
  columnCount: number;
  unknownColumns: string[];
  /** Required columns that didn't appear, in template order. */
  missingColumns: string[];
  /** Template columns that appeared more than once, in template order. */
  duplicateColumns: string[];
}

export interface LoadedSheet<TKey extends string> {
  worksheet: ExcelJS.Worksheet;
  resolution: HeaderResolution<TKey>;
}

/**
 * Open an xlsx buffer, take the first worksheet, read its header row, and
 * resolve the header labels against the supplied template. Returns `null`
 * when the workbook has no worksheet — callers return their own empty
 * envelope. The template's required columns are reported as `missingColumns`.
 */
export async function loadAndResolveHeaders<TKey extends string>(
  buffer: Buffer,
  template: TemplateConfig<TKey>
): Promise<LoadedSheet<TKey> | null> {
  const workbook = new ExcelJS.Workbook();
  // @types/node v24 made Buffer generic over ArrayBufferLike; exceljs's
  // d.ts still declares the legacy shape. Runtime accepts either.
  await workbook.xlsx.load(
    buffer as unknown as Parameters<typeof workbook.xlsx.load>[0]
  );
  const worksheet = workbook.worksheets[0];
  if (!worksheet) return null;

  const headerRow = worksheet.getRow(1);
  const columnCount = Math.min(
    worksheet.columnCount || headerRow.cellCount || 0,
    MAX_COLS
  );
  const headerValues: string[] = [];
  for (let c = 1; c <= columnCount; c++) {
    headerValues.push(cellText(headerRow.getCell(c).value));
  }

  const headerToKey =
    template.headerToKey ??
    new Map(
      (Object.entries(template.columns) as [TKey, string][]).map(
        ([k, label]) => [normalizeHeader(label), k]
      )
    );

  const headerKeys: (TKey | null)[] = headerValues.map((h) => {
    if (!h) return null;
    return headerToKey.get(normalizeHeader(h)) ?? null;
  });

  const seenKeys = new Set<TKey>();
  const duplicateKeys = new Set<TKey>();
  for (const k of headerKeys) {
    if (!k) continue;
    if (seenKeys.has(k)) duplicateKeys.add(k);
    else seenKeys.add(k);
  }

  const unknownColumns = headerValues.filter(
    (h, i) => h && headerKeys[i] === null
  );
  const orderIndex = (k: TKey) => template.order.indexOf(k);
  const missingColumns = template.required
    .filter((k) => !seenKeys.has(k))
    .sort((a, b) => orderIndex(a) - orderIndex(b))
    .map((k) => template.columns[k]);
  const duplicateColumns = [...duplicateKeys]
    .sort((a, b) => orderIndex(a) - orderIndex(b))
    .map((k) => template.columns[k]);

  return {
    worksheet,
    resolution: {
      headerValues,
      headerKeys,
      columnCount,
      unknownColumns,
      missingColumns,
      duplicateColumns,
    },
  };
}

export interface DataRowContext<TKey extends string> {
  /** Literal Excel row index (header is row 1). */
  excelRowNumber: number;
  /** 1-based index among non-blank data rows. */
  dataRowIndex: number;
  raw: Record<string, unknown>;
  byKey: Partial<Record<TKey, string>>;
}

/**
 * Walk the data rows of a resolved sheet, skipping fully blank rows,
 * stopping at `maxDataRows` and reporting `truncated` when more rows
 * follow. Returns the truncation flag so the caller can surface it.
 */
export function forEachDataRow<TKey extends string>(
  worksheet: ExcelJS.Worksheet,
  resolution: HeaderResolution<TKey>,
  maxDataRows: number,
  visit: (ctx: DataRowContext<TKey>) => void
): { truncated: boolean } {
  const { headerValues, headerKeys, columnCount } = resolution;
  const lastRow = Math.min(worksheet.actualRowCount, maxDataRows + 1);
  const truncated = worksheet.actualRowCount > maxDataRows + 1;
  let dataRowIndex = 0;
  for (let r = 2; r <= lastRow; r++) {
    const excelRow = worksheet.getRow(r);
    if (!excelRow || excelRow.cellCount === 0) continue;
    dataRowIndex += 1;

    const raw: Record<string, unknown> = {};
    const byKey: Partial<Record<TKey, string>> = {};
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

    visit({ excelRowNumber: r, dataRowIndex, raw, byKey });
  }
  return { truncated };
}

// ── Parse envelope ───────────────────────────────────────────────────────

/**
 * Generic shape returned by both `parseElementSheet` and `parseBoqSheet` —
 * the row payload type is template-specific, but the surrounding envelope
 * (header diagnostics + truncation flag) is identical.
 */
export interface ParseEnvelope<TRow> {
  headers: string[];
  unknownColumns: string[];
  missingColumns: string[];
  /** Template columns that appeared more than once — latest occurrence wins. */
  duplicateColumns: string[];
  rows: TRow[];
  totalRows: number;
  truncated?: boolean;
}

/**
 * Result for the no-worksheet branch — the workbook had no first sheet.
 * Reports all required columns as missing so the dialog tells the user
 * what to add, instead of silently treating an empty file as zero rows.
 */
export function emptyParseEnvelope<TKey extends string, TRow>(
  template: TemplateConfig<TKey>
): ParseEnvelope<TRow> {
  return {
    headers: [],
    unknownColumns: [],
    missingColumns: template.required.map((k) => template.columns[k]),
    duplicateColumns: [],
    rows: [],
    totalRows: 0,
  };
}

/**
 * Wrap parsed rows + a `HeaderResolution` into the final envelope shape.
 * `headers` is filtered to drop blank cells in the header row so the
 * preview doesn't render placeholders.
 */
export function buildParseEnvelope<TKey extends string, TRow>(
  resolution: HeaderResolution<TKey>,
  rows: TRow[],
  truncated: boolean
): ParseEnvelope<TRow> {
  return {
    headers: resolution.headerValues.filter((h) => h),
    unknownColumns: resolution.unknownColumns,
    missingColumns: resolution.missingColumns,
    duplicateColumns: resolution.duplicateColumns,
    rows,
    totalRows: rows.length,
    truncated,
  };
}

// ── Optional numeric field parsing ───────────────────────────────────────

export interface NumericRange {
  min: number;
  /** Omit for an open-ended range (e.g. material costs). */
  max?: number;
}

/**
 * Parse an optional numeric field from a row's `byKey` map. Pushes any
 * validation errors and ambiguity warnings to the caller's arrays;
 * returns the parsed number when valid, undefined otherwise.
 *
 * Used by both element and BOQ parsers for the cost / pct field loops.
 */
export function parseOptionalNumericField(
  raw: string | undefined,
  label: string,
  range: NumericRange,
  errors: string[],
  warnings: string[]
): number | undefined {
  if (raw === undefined || raw === "") return undefined;
  const res = cellNumber(raw);
  if (res.value === null) {
    errors.push(`${label} must be a number`);
    return undefined;
  }
  const { min, max } = range;
  if (res.value < min || (max !== undefined && res.value > max)) {
    if (max === undefined) {
      errors.push(
        min === 0
          ? `${label} must be zero or positive`
          : `${label} must be at least ${min}`
      );
    } else {
      errors.push(`${label} must be between ${min} and ${max}`);
    }
    return undefined;
  }
  if (res.ambiguous) {
    warnings.push(
      `${label} "${raw}" is ambiguous — parsed as ${res.value}. Edit the sheet if this is wrong.`
    );
  }
  return res.value;
}

/**
 * Validate the required `unit` cell against `ALLOWED_UNITS`. Pushes the
 * standard "Unit is required" / "Unit \"X\" is not allowed" message to
 * `errors` on failure; returns the lower-cased `ElementUnit` on success.
 */
export function parseRequiredUnitField(
  raw: string | undefined,
  allowedUnits: readonly string[],
  errors: string[]
): string | undefined {
  const rawUnit = (raw ?? "").toLowerCase();
  if (!rawUnit) {
    errors.push("Unit is required");
    return undefined;
  }
  if (!allowedUnits.includes(rawUnit)) {
    errors.push(
      `Unit "${raw}" is not allowed (must be one of: ${allowedUnits.join(", ")})`
    );
    return undefined;
  }
  return rawUnit;
}

/** The four cost/pct fields shared between the element and BOQ templates. */
export const SHARED_FINANCIAL_FIELDS = [
  "materialCost",
  "labourCost",
  "overheadPct",
  "marginPct",
] as const;
type SharedFinancialKey = (typeof SHARED_FINANCIAL_FIELDS)[number];

interface SharedFinancialValues {
  materialCost?: number;
  labourCost?: number;
  overheadPct?: number;
  marginPct?: number;
}

/**
 * Parse the four optional cost/pct fields that both the element and BOQ
 * templates share — non-negative `materialCost`/`labourCost` and 0-100
 * `overheadPct`/`marginPct`. Mutates `values`/`errors`/`warnings` in place.
 */
export function parseSharedFinancialFields<T extends SharedFinancialValues>(
  byKey: Partial<Record<SharedFinancialKey, string>>,
  values: Partial<T>,
  errors: string[],
  warnings: string[]
): void {
  for (const [k, label, range] of [
    ["materialCost", "Material Cost", { min: 0 }],
    ["labourCost", "Labour Cost", { min: 0 }],
    ["overheadPct", "Overhead %", { min: 0, max: 100 }],
    ["marginPct", "Margin %", { min: 0, max: 100 }],
  ] as const) {
    const v = parseOptionalNumericField(
      byKey[k],
      label,
      range,
      errors,
      warnings
    );
    if (v !== undefined) {
      (values as SharedFinancialValues)[k] = v;
    }
  }
}
