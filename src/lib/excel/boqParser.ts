import type {
  BoqElementLite,
  BoqParseResult,
  ParsedBoqRow,
  ParsedBoqValues,
  ElementCategory,
} from "@/types";
import { ALLOWED_UNITS } from "@/lib/validations";
import {
  buildCategoryLevelMap,
  buildCategoryPathMap,
  resolveCategoryPathCell,
} from "./categoryPaths";
import {
  buildParseEnvelope,
  cellBool,
  emptyParseEnvelope,
  forEachDataRow,
  loadAndResolveHeaders,
  normalizeHeader,
  parseOptionalNumericField,
  parseRequiredNumericField,
  parseRequiredUnitField,
  parseSharedFinancialFields,
  type TemplateConfig,
} from "./_shared";

/** Frozen sentinel reused for clean-row `raw` slots — see `parseBoqSheet`. */
const EMPTY_RAW: Record<string, unknown> = Object.freeze({});

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
  categoryPath: "Category Path",
  description: "Description",
  unit: "Unit",
  quantity: "Quantity",
  unitCost: "Unit Cost",
  materialCost: "Material Cost",
  labourCost: "Labour Cost",
  overheadPct: "Overhead %",
  serviceChargePct: "Service Charge %",
  marginPct: "Margin %",
  clientRate: "Client Rate",
  budgetRate: "Budget Rate",
  length: "Length",
  breadth: "Breadth",
  height: "Height",
  dimensionUnit: "Dimension Unit",
  notes: "Notes",
  clientNotes: "Client Notes",
  isProvisional: "Is Provisional",
} as const;

type TemplateKey = keyof typeof TEMPLATE_COLUMNS;

const REQUIRED_COLUMNS: readonly TemplateKey[] = [
  "description",
  "categoryPath",
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

const TEMPLATE: TemplateConfig<TemplateKey> = {
  columns: TEMPLATE_COLUMNS,
  required: REQUIRED_COLUMNS,
  order: Object.keys(TEMPLATE_COLUMNS) as TemplateKey[],
  headerToKey: HEADER_TO_KEY,
};

/** Hoisted out of the parse loop — avoids re-allocating per row × per import. */
const OPTIONAL_STRING_FIELDS = [
  ["sectionTitle", "Section", 255],
  ["itemCode", "Item Code", 50],
  ["notes", "Notes", 2000],
  ["clientNotes", "Client Notes", 2000],
] as const;

/**
 * Per-line physical dimensions. BoQ-only (not shared with the element
 * parser, since `element` doesn't carry dimensions). Parsed as
 * non-negative numbers; blank cells stay undefined and the row is
 * still valid.
 */
const OPTIONAL_DIMENSION_FIELDS: ReadonlyArray<
  readonly ["length" | "breadth" | "height", string]
> = [
  ["length", "Length"],
  ["breadth", "Breadth"],
  ["height", "Height"],
];

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
  elementsByCode: Map<string, BoqElementLite>,
  categories: Array<
    Pick<ElementCategory, "id" | "name" | "parent_id" | "level">
  >
): Promise<BoqParseResult> {
  const pathMap = buildCategoryPathMap(categories);
  const levelById = buildCategoryLevelMap(categories);
  const loaded = await loadAndResolveHeaders(buffer, TEMPLATE);
  if (!loaded) {
    return emptyParseEnvelope<TemplateKey, ParsedBoqRow>(TEMPLATE);
  }

  const { worksheet, resolution } = loaded;
  const rows: ParsedBoqRow[] = [];

  const { truncated } = forEachDataRow(
    worksheet,
    resolution,
    MAX_DATA_ROWS,
    ({ excelRowNumber, raw, byKey }) => {
      const errors: string[] = [];
      const warnings: string[] = [];
      // `rowNumber` carries the literal Excel row index throughout — the
      // server's `failed[].rowNumber` matches what the user sees in the
      // sheet and in the preview, regardless of blank rows above.
      const values: Partial<ParsedBoqValues> = { rowNumber: excelRowNumber };

      // ── Description (required)
      if (!byKey.description) {
        errors.push("Description is required");
      } else if (byKey.description.length > 2000) {
        errors.push("Description must be 2000 characters or fewer");
      } else {
        values.description = byKey.description;
      }

      // ── Unit (required, enum)
      const unit = parseRequiredUnitField(byKey.unit, ALLOWED_UNITS, errors);
      if (unit) values.unit = unit;

      // ── Quantity + Unit Cost (required, non-negative)
      const qty = parseRequiredNumericField(
        byKey.quantity,
        "Quantity",
        { min: 0 },
        errors,
        warnings
      );
      if (qty !== undefined) values.quantity = qty;

      const unitCost = parseRequiredNumericField(
        byKey.unitCost,
        "Unit Cost",
        { min: 0 },
        errors,
        warnings
      );
      if (unitCost !== undefined) values.unitCost = unitCost;

      // ── Optional cost + percentage fields (shared shape with elements)
      parseSharedFinancialFields(byKey, values, errors, warnings);

      // ── Optional dimension fields (BoQ-only, non-negative)
      for (const [k, label] of OPTIONAL_DIMENSION_FIELDS) {
        const v = parseOptionalNumericField(
          byKey[k],
          label,
          { min: 0 },
          errors,
          warnings
        );
        if (v !== undefined) values[k] = v;
      }

      // ── Dimension unit (optional; blank → 'm' for legacy templates).
      // Values are case-insensitive so the user can type `M`, `Ft`, etc.
      if (byKey.dimensionUnit !== undefined && byKey.dimensionUnit !== "") {
        const u = byKey.dimensionUnit.toLowerCase();
        if (u === "m" || u === "ft") {
          values.dimensionUnit = u;
        } else {
          errors.push(
            `Dimension Unit "${byKey.dimensionUnit}" must be m or ft`
          );
        }
      }

      // ── Optional strings with length caps
      for (const [k, label, max] of OPTIONAL_STRING_FIELDS) {
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

      // ── Service Area (required). A row whose Item Code links to a library
      //    element inherits that element's — so the path column is only needed
      //    for free-text lines.
      const inherited = linkedElement?.category_id ?? null;
      if (!byKey.categoryPath) {
        if (inherited) {
          values.categoryId = inherited;
        } else {
          errors.push(
            "Category Path is required — give the full path to a Service Area, e.g. 'Kitchen > Cabinets > Base Cabinets' (or use an Item Code that matches a library element)"
          );
        }
      } else {
        const resolved = resolveCategoryPathCell(
          byKey.categoryPath,
          pathMap,
          levelById
        );
        if (resolved.ok) values.categoryId = resolved.id;
        else errors.push(resolved.error);
      }

      const hasErrors = errors.length > 0;
      rows.push({
        rowNumber: excelRowNumber,
        // `raw` is only consumed in the dialog as a fallback when `parsed` is
        // null. Share a single frozen `{}` across clean rows so a 5,000-row
        // sheet doesn't allocate 5,000 empty maps just to ship `"raw":{}`.
        raw: hasErrors ? raw : EMPTY_RAW,
        parsed: hasErrors ? null : (values as ParsedBoqValues),
        linkedElement,
        status: hasErrors ? "error" : "valid",
        errors,
        warnings,
      });
    }
  );

  return buildParseEnvelope(resolution, rows, truncated);
}
