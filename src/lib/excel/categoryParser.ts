import {
  CATEGORY_CODE_MAX,
  composeCategoryCode,
  normalizeCodeSegment,
} from "@/lib/categoryCode";
import { categoryKey } from "./categoryPaths";
import type { SpreadsheetFormat } from "./uploadGuard";
import {
  buildParseEnvelope,
  emptyParseEnvelope,
  forEachDataRow,
  loadAndResolveHeaders,
  normalizeHeader,
  type TemplateConfig,
} from "./_shared";

/**
 * One rung of a path: the node's name, and the code *segment* the sheet gave
 * for it. The stored `code_prefix` is the segments composed down the path —
 * `KIT`, `KIT-CAB`, `KIT-CAB-BASE` — not the segment alone.
 */
export interface ParsedCategoryNode {
  name: string;
  /** Composed full-path code, or null when the sheet left the code blank. */
  codePrefix: string | null;
}

/** A single sheet row: the chain it declares, top-level first. */
export interface ParsedCategoryValues {
  rowNumber: number;
  /** 2 or 3 rungs — a row may stop at a Sub-category with no Service Area yet. */
  path: ParsedCategoryNode[];
}

export interface ParsedCategoryRow {
  rowNumber: number;
  excelRowNumber: number;
  raw: Record<string, unknown>;
  parsed: ParsedCategoryValues | null;
  status: "valid" | "error";
  errors: string[];
  warnings: string[];
}

export type CategoryParseResult = {
  headers: string[];
  unknownColumns: string[];
  missingColumns: string[];
  duplicateColumns: string[];
  rows: ParsedCategoryRow[];
  totalRows: number;
  truncated?: boolean;
};

/**
 * A taxonomy is a few hundred rows, not tens of thousands like an element
 * library — a sheet far past this is a mistake, not a big import.
 */
const MAX_DATA_ROWS = 5_000;

const TEMPLATE_COLUMNS = {
  category: "Category",
  categoryCode: "Category Code",
  subcategory: "Sub-category",
  subcategoryCode: "Sub-category Code",
  serviceArea: "Service Area",
  serviceAreaCode: "Service Area Code",
} as const;

type TemplateKey = keyof typeof TEMPLATE_COLUMNS;

/**
 * Only the Category is required. A branch may stop at any rung: the UI can make
 * a Category with no Sub-categories, and a Sub-category with no Service Areas,
 * so the sheet has to be able to say both — otherwise exporting the tree and
 * importing it straight back would drop the nodes it couldn't express, and the
 * diff would read those as deletions.
 */
const REQUIRED_COLUMNS: TemplateKey[] = ["category"];

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

export const CATEGORY_TEMPLATE_COLUMNS: Record<TemplateKey, string> =
  TEMPLATE_COLUMNS;
export const CATEGORY_TEMPLATE_ORDER: TemplateKey[] = Object.keys(
  TEMPLATE_COLUMNS
) as TemplateKey[];

const NAME_MAX = 150;

/** The rungs, in order, with the label used when complaining about each. */
const RUNGS = [
  ["category", "categoryCode", "Category"],
  ["subcategory", "subcategoryCode", "Sub-category"],
  ["serviceArea", "serviceAreaCode", "Service Area"],
] as const;

/**
 * Parse a category sheet into the chains it declares. Pure — no DB access, so
 * it is safe to run in the preview request. The diff against what already
 * exists happens later, in `planCategoryImport`.
 *
 * Each row is one full path repeated from the top, the same denormalised shape
 * the element import uses: people build these in Excel by dragging a Category
 * down a column, and asking them to leave parent cells blank invites the
 * classic "which row does this orphan belong to" mess.
 */
export async function parseCategorySheet(
  buffer: Buffer,
  format: SpreadsheetFormat = "xlsx"
): Promise<CategoryParseResult> {
  const loaded = await loadAndResolveHeaders(buffer, TEMPLATE, format);
  if (!loaded) {
    return emptyParseEnvelope<TemplateKey, ParsedCategoryRow>(TEMPLATE);
  }

  const { worksheet, resolution } = loaded;
  const rows: ParsedCategoryRow[] = [];
  /** Lower-cased name path → the row that first claimed it. */
  const seenPaths = new Map<string, number>();
  /** Lower-cased name path → the code it was given, to catch contradictions. */
  const codeByPath = new Map<string, string | null>();

  const { truncated } = forEachDataRow(
    worksheet,
    resolution,
    MAX_DATA_ROWS,
    ({ excelRowNumber, dataRowIndex, raw, byKey }) => {
      const errors: string[] = [];
      const warnings: string[] = [];
      const path: ParsedCategoryNode[] = [];

      let parentPrefix: string | null = null;

      for (const [nameKey, codeKey, label] of RUNGS) {
        const name = (byKey[nameKey] ?? "").trim();
        const rawCode = (byKey[codeKey] ?? "").trim();

        if (!name) {
          // The branch stops here. That's legal at every rung below the
          // Category — but a code with no node to hang it on is a half-filled
          // row, not a branch that ended.
          if (label === "Category") {
            errors.push("Category is required");
          } else if (rawCode) {
            errors.push(`${label} Code was given without a ${label}`);
          }
          break;
        }
        if (name.length > NAME_MAX) {
          errors.push(`${label} must be ${NAME_MAX} characters or fewer`);
          break;
        }

        // Codes are optional per node, but a child cannot carry one if its
        // parent doesn't — the stored code is the whole path, so there would be
        // nothing to compose onto.
        let codePrefix: string | null = null;
        if (rawCode) {
          const segment = normalizeCodeSegment(rawCode);
          if (!segment) {
            errors.push(
              `${label} Code "${rawCode}" has no letters or digits to use`
            );
            break;
          }
          const composed = composeCategoryCode(parentPrefix, segment);
          if (composed.length > CATEGORY_CODE_MAX) {
            errors.push(
              `${label} code "${composed}" is longer than ${CATEGORY_CODE_MAX} characters`
            );
            break;
          }
          codePrefix = composed;
        } else if (parentPrefix) {
          warnings.push(
            `${label} has no code, so nothing under it can be coded either`
          );
        }

        path.push({ name, codePrefix });
        parentPrefix = codePrefix;
      }

      if (errors.length === 0) {
        const key = categoryKey(path.map((n) => n.name));
        const first = seenPaths.get(key);
        if (first !== undefined) {
          errors.push(`Duplicate path — already declared on row ${first}`);
        } else {
          seenPaths.set(key, dataRowIndex);
        }

        // The same node named on two rows carrying two different codes: the
        // sheet contradicts itself, and quietly taking the last one would hide a
        // typo that then cascades into every child's code.
        const ancestry: string[] = [];
        for (const node of path) {
          ancestry.push(node.name);
          const nodeKey = categoryKey(ancestry);
          if (!codeByPath.has(nodeKey)) {
            codeByPath.set(nodeKey, node.codePrefix);
            continue;
          }
          const previous = codeByPath.get(nodeKey) ?? null;
          if (previous !== node.codePrefix) {
            errors.push(
              `"${node.name}" is coded ${node.codePrefix ?? "(none)"} here but ${previous ?? "(none)"} on an earlier row`
            );
          }
        }
      }

      const hasErrors = errors.length > 0;
      rows.push({
        rowNumber: dataRowIndex,
        excelRowNumber,
        raw,
        parsed: hasErrors ? null : { rowNumber: dataRowIndex, path },
        status: hasErrors ? "error" : "valid",
        errors,
        warnings,
      });
    }
  );

  return buildParseEnvelope(resolution, rows, truncated);
}
