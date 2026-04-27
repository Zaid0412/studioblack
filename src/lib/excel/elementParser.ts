import type { ElementCategory } from "@/types";
import { ALLOWED_UNITS, type ElementUnit } from "@/lib/validations";
import {
  buildParseEnvelope,
  cellNumber,
  emptyParseEnvelope,
  forEachDataRow,
  loadAndResolveHeaders,
  normalizeHeader,
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

      // ── Unit (required, enum)
      const unit = parseRequiredUnitField(byKey.unit, ALLOWED_UNITS, errors);
      if (unit) values.unit = unit as ElementUnit;

      // ── Unit cost (required, non-negative). Inline because the
      // missing-value error is "is required", not "must be a number".
      const unitCostResult = cellNumber(byKey.unitCost);
      if (unitCostResult.value === null) {
        errors.push("Unit Cost is required");
      } else if (unitCostResult.value < 0) {
        errors.push("Unit Cost must be zero or positive");
      } else {
        values.unitCost = unitCostResult.value;
        if (unitCostResult.ambiguous) {
          warnings.push(
            `Unit Cost "${byKey.unitCost ?? ""}" is ambiguous — parsed as ${unitCostResult.value}. Edit the sheet if this is wrong.`
          );
        }
      }

      // ── Optional cost + percentage fields (shared shape with BOQ)
      parseSharedFinancialFields(byKey, values, errors, warnings);

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
          const lookupKey = rawSegments
            .map(normalizeCategorySegment)
            .join(" > ");
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
