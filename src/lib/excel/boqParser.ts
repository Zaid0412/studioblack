import type {
  BoqElementLite,
  BoqParseResult,
  ParsedBoqRow,
  ParsedBoqValues,
} from "@/types";
import { ALLOWED_UNITS, type ElementUnit } from "@/lib/validations";
import {
  buildParseEnvelope,
  cellBool,
  cellNumber,
  emptyParseEnvelope,
  forEachDataRow,
  loadAndResolveHeaders,
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

const REQUIRED_COLUMNS: readonly TemplateKey[] = [
  "description",
  "unit",
  "quantity",
  "unitCost",
];

const TEMPLATE: TemplateConfig<TemplateKey> = {
  columns: TEMPLATE_COLUMNS,
  required: REQUIRED_COLUMNS,
  order: Object.keys(TEMPLATE_COLUMNS) as TemplateKey[],
};

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
      if (unit) values.unit = unit as ElementUnit;

      // ── Quantity (required, non-negative). Inline because the missing-value
      // error is "Quantity is required", not "Quantity must be a number".
      const qtyRes = cellNumber(byKey.quantity);
      if (qtyRes.value === null) {
        errors.push("Quantity is required");
      } else if (qtyRes.value < 0) {
        errors.push("Quantity must be zero or positive");
      } else {
        values.quantity = qtyRes.value;
        if (qtyRes.ambiguous) {
          warnings.push(
            `Quantity "${byKey.quantity ?? ""}" is ambiguous — parsed as ${qtyRes.value}. Edit the sheet if this is wrong.`
          );
        }
      }

      // ── Unit Cost (required, non-negative). Same shape as Quantity.
      const unitCostRes = cellNumber(byKey.unitCost);
      if (unitCostRes.value === null) {
        errors.push("Unit Cost is required");
      } else if (unitCostRes.value < 0) {
        errors.push("Unit Cost must be zero or positive");
      } else {
        values.unitCost = unitCostRes.value;
        if (unitCostRes.ambiguous) {
          warnings.push(
            `Unit Cost "${byKey.unitCost ?? ""}" is ambiguous — parsed as ${unitCostRes.value}. Edit the sheet if this is wrong.`
          );
        }
      }

      // ── Optional cost + percentage fields (shared shape with elements)
      parseSharedFinancialFields(byKey, values, errors, warnings);

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
