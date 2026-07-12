import type { ElementCategory } from "@/types";
import { SERVICE_AREA_LEVEL } from "@/lib/categoryCode";
import { ALLOWED_UNITS, type ElementUnit } from "@/lib/validations";
import {
  buildParseEnvelope,
  emptyParseEnvelope,
  forEachDataRow,
  loadAndResolveHeaders,
  normalizeHeader,
  parseRequiredNumericField,
  parseRequiredUnitField,
  parseSharedFinancialFields,
  type TemplateConfig,
} from "./_shared";

/**
 * Parsed values for one row. Shape aligns with `importElementRowSchema` so the
 * server can re-validate on confirm without any remapping.
 */
export interface ParsedElementValues {
  rowNumber: number;
  /** Blank means "assign one" — the server generates it from the category. */
  code?: string;
  name: string;
  description?: string;
  /** Required: an element must sit under a Service Area. */
  categoryPath: string[];
  unit: ElementUnit;
  unitCost: number;
  currency?: string;
  materialCost?: number;
  labourCost?: number;
  overheadPct?: number;
  serviceChargePct?: number;
  marginPct?: number;
  clientRate?: number;
  budgetRate?: number;
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
// `MAX_COLS` is shared with the BOQ parser via `_shared.ts`. The element
// row cap is higher because element libraries are typically ~10× the size
// of any individual project's BOQ.
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
  serviceChargePct: "Service Charge %",
  marginPct: "Margin %",
  clientRate: "Client Rate",
  budgetRate: "Budget Rate",
  specReference: "Spec Reference",
  drawingRef: "Drawing Ref",
  tags: "Tags",
} as const;

type TemplateKey = keyof typeof TEMPLATE_COLUMNS;

const REQUIRED_COLUMNS: TemplateKey[] = [
  "name",
  "categoryPath",
  "unit",
  "unitCost",
];

/** Case-insensitive lookup from normalized header label → template key. */
const HEADER_TO_KEY: Map<string, TemplateKey> = new Map(
  (Object.entries(TEMPLATE_COLUMNS) as [TemplateKey, string][]).map(
    ([k, label]) => [normalizeHeader(label), k]
  )
);

const TEMPLATE: TemplateConfig<TemplateKey> = {
  columns: TEMPLATE_COLUMNS,
  required: REQUIRED_COLUMNS,
  order: Object.keys(TEMPLATE_COLUMNS) as TemplateKey[],
  headerToKey: HEADER_TO_KEY,
};

export const TEMPLATE_COLUMN_LABELS: Record<TemplateKey, string> =
  TEMPLATE_COLUMNS;
export const TEMPLATE_COLUMN_ORDER: TemplateKey[] = Object.keys(
  TEMPLATE_COLUMNS
) as TemplateKey[];

/** Hoisted out of the parse loop — avoids re-allocating per row × per import. */
const OPTIONAL_STRING_FIELDS = [
  ["description", "Description", 2000],
  ["specReference", "Spec Reference", 255],
  ["drawingRef", "Drawing Ref", 255],
] as const;

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
  categories: Array<Pick<ElementCategory, "id" | "name" | "parent_id">>
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
  const loaded = await loadAndResolveHeaders(buffer, TEMPLATE);
  if (!loaded) {
    return emptyParseEnvelope<TemplateKey, ParsedElementRow>(TEMPLATE);
  }

  const { worksheet, resolution } = loaded;
  const pathMap = buildCategoryPathMap(categories);
  const levelById = new Map(categories.map((c) => [c.id, c.level]));
  const rows: ParsedElementRow[] = [];
  // Case-sensitive: the DB `element.code` column is VARCHAR (not CITEXT)
  // and uniqueness is enforced at the app layer against the exact literal,
  // so "A-01" and "a-01" are distinct codes end-to-end.
  const seenCodes = new Map<string, number>();

  const { truncated } = forEachDataRow(
    worksheet,
    resolution,
    MAX_DATA_ROWS,
    ({ excelRowNumber, dataRowIndex, raw, byKey }) => {
      const errors: string[] = [];
      const warnings: string[] = [];
      const values: Partial<ParsedElementValues> = { rowNumber: dataRowIndex };

      // ── Code (optional — a blank cell means the server assigns one; a
      //    supplied code is the join key for the skip/overwrite/version
      //    strategies, so it is taken literally)
      if (byKey.code) {
        if (byKey.code.length > 50) {
          errors.push("Code must be 50 characters or fewer");
        } else {
          values.code = byKey.code;
        }
      }

      if (byKey.name === undefined || byKey.name === "") {
        errors.push("Name is required");
      } else if (byKey.name.length > 255) {
        errors.push("Name must be 255 characters or fewer");
      } else {
        values.name = byKey.name;
      }

      // ── Unit (required, enum)
      const unit = parseRequiredUnitField(byKey.unit, ALLOWED_UNITS, errors);
      if (unit) values.unit = unit;

      // ── Unit cost (required, non-negative)
      const unitCost = parseRequiredNumericField(
        byKey.unitCost,
        "Unit Cost",
        { min: 0 },
        errors,
        warnings
      );
      if (unitCost !== undefined) values.unitCost = unitCost;

      // ── Optional cost + percentage fields (shared shape with BOQ)
      parseSharedFinancialFields(byKey, values, errors, warnings);

      // ── Optional strings with length caps
      for (const [k, label, max] of OPTIONAL_STRING_FIELDS) {
        const v = byKey[k];
        if (v) {
          if (v.length > max)
            errors.push(`${label} must be ${max} characters or fewer`);
          else values[k] = v;
        }
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

      // ── Category path (required — an element must sit under a Service Area)
      if (!byKey.categoryPath) {
        errors.push(
          "Category Path is required — give the full path to a Service Area, e.g. 'Kitchen > Cabinets > Base Cabinets'"
        );
      } else {
        const rawSegments = byKey.categoryPath.split(">").map((s) => s.trim());
        const hasEmptySegment = rawSegments.some((s) => s.length === 0);
        if (rawSegments.length === 0 || hasEmptySegment) {
          errors.push(
            "Category Path has empty segments — use 'A > B > C' with non-empty labels"
          );
        } else {
          const lookupKey = rawSegments
            .map(normalizeCategorySegment)
            .join(" > ");
          const resolved = pathMap.get(lookupKey);
          if (!resolved) {
            errors.push(
              `Category path "${rawSegments.join(" > ")}" not found in this org`
            );
          } else if (levelById.get(resolved) !== SERVICE_AREA_LEVEL) {
            errors.push(
              `Category path "${rawSegments.join(" > ")}" is not a Service Area — elements must sit under one`
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
          errors.push(
            `Duplicate code in sheet — first seen on row ${firstSeen}`
          );
        } else {
          seenCodes.set(values.code, dataRowIndex);
        }
      }

      const hasErrors = errors.length > 0;
      rows.push({
        rowNumber: dataRowIndex,
        excelRowNumber,
        raw,
        parsed: hasErrors ? null : (values as ParsedElementValues),
        status: hasErrors ? "error" : "valid",
        errors,
        warnings,
      });
    }
  );

  return buildParseEnvelope(resolution, rows, truncated);
}
