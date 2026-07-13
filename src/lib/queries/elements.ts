import type { PoolClient } from "pg";
import { getPool } from "@/lib/db";
import { logger } from "@/lib/logger";
import { DEFAULT_PAGE_LIMIT, DEFAULT_CURRENCY } from "@/lib/constants";
import {
  buildCategoryLevelMap,
  buildCategoryPathMap,
  normalizeCategorySegment,
  notAServiceAreaError,
} from "@/lib/excel/elementParser";
import type {
  Element,
  ElementAttribute,
  ElementCategory,
  ElementWithDetails,
} from "@/types";
import { escapeSqlLike, descendantCategoryIdsSql } from "./helpers";
import { SERVICE_AREA_LEVEL, UNCATEGORIZED_PREFIX } from "@/lib/categoryCode";
import {
  elementCodePrefix,
  nextElementCodes,
  requireServiceArea,
  syncElementCounter,
} from "./sequences";
import { mapPgError } from "./_pgErrors";

export interface ElementFilters {
  search?: string;
  categoryId?: string;
  unit?: string;
  tags?: string[];
  isActive?: boolean;
  sortBy?: "code" | "name" | "unit_cost" | "updated_at";
  sortOrder?: "asc" | "desc";
  page?: number;
  limit?: number;
}

/**
 * Whitelist of sortable columns. Validated values map to literal SQL
 * fragments — ORDER BY can't take a parameter.
 */
const ELEMENT_SORT_SQL: Record<
  NonNullable<ElementFilters["sortBy"]>,
  string
> = {
  code: "e.code",
  name: "lower(e.name)",
  unit_cost: "e.unit_cost",
  updated_at: "e.updated_at",
};

export interface CreateElementInput {
  name: string;
  description?: string;
  /** Required, and must be a Service Area (level 3). */
  categoryId: string;
  unit: string;
  unitCost: number;
  currency?: string;
  materialCost?: number;
  labourCost?: number;
  overheadPct?: number;
  serviceChargePct?: number;
  marginPct?: number;
  clientRate?: number | null;
  budgetRate?: number | null;
  specReference?: string;
  drawingRef?: string;
  tags?: string[];
  attributes?: Array<{
    attribute_key: string;
    attribute_value: string;
    unit?: string;
    sort_order?: number;
  }>;
  imageUrl?: string | null;
  drawingFileUrl?: string | null;
  drawingFileName?: string | null;
  specFileUrl?: string | null;
  specFileName?: string | null;
}

export type UpdateElementInput = Partial<CreateElementInput> & {
  isActive?: boolean;
};

/**
 * Writable columns for `updateElement`. `code` is deliberately absent — it is
 * assigned once at creation from the category's path code + a sequence, and is
 * referenced from BOQ items and as the Excel import's join key, so it must not
 * drift. (Sorting on code goes through ELEMENT_SORT_SQL, not this map.)
 */
const ELEMENT_COLS: Record<string, string> = {
  name: "name",
  description: "description",
  categoryId: "category_id",
  unit: "unit",
  unitCost: "unit_cost",
  currency: "currency",
  materialCost: "material_cost",
  labourCost: "labour_cost",
  overheadPct: "overhead_pct",
  serviceChargePct: "service_charge_pct",
  marginPct: "margin_pct",
  clientRate: "client_rate",
  budgetRate: "budget_rate",
  specReference: "spec_reference",
  drawingRef: "drawing_ref",
  tags: "tags",
  isActive: "is_active",
  imageUrl: "image_url",
  drawingFileUrl: "drawing_file_url",
  drawingFileName: "drawing_file_name",
  specFileUrl: "spec_file_url",
  specFileName: "spec_file_name",
};

/**
 * List elements for an org with filters + pagination.
 * Uses `COUNT(*) OVER()` for the total so it's one round-trip.
 * Category filter is descendant-inclusive via a recursive CTE.
 */
/**
 * Build the shared WHERE clause + params for element listing queries. Operates
 * on the collapsed-latest view, so filters here apply to the latest version of
 * each group. Search is handled separately — see `buildElementWhere`'s caller
 * in `getElements` for the EXISTS against raw `element` rows.
 */
function buildElementWhere(
  orgId: string,
  filters: ElementFilters
): { where: string; params: unknown[] } {
  const conditions: string[] = ["e.org_id = $1"];
  const params: unknown[] = [orgId];

  if (filters.categoryId) {
    params.push(filters.categoryId);
    conditions.push(
      `e.category_id IN ${descendantCategoryIdsSql(params.length)}`
    );
  }

  if (filters.unit) {
    params.push(filters.unit);
    conditions.push(`e.unit = $${params.length}`);
  }

  if (filters.tags && filters.tags.length > 0) {
    params.push(filters.tags);
    conditions.push(`e.tags && $${params.length}::text[]`);
  }

  if (filters.isActive !== undefined) {
    params.push(filters.isActive);
    conditions.push(`e.is_active = $${params.length}`);
  }

  return { where: conditions.join(" AND "), params };
}

/**
 * Paginated list of the latest version of each element in an org. Search runs
 * across every version of a group, then results collapse to the newest row.
 */
export async function getElements(orgId: string, filters: ElementFilters = {}) {
  const pool = getPool();
  const page = filters.page ?? 1;
  const limit = filters.limit ?? DEFAULT_PAGE_LIMIT;
  const offset = (page - 1) * limit;

  const { where, params } = buildElementWhere(orgId, filters);

  // Search runs against *every* version of each group — an older version's
  // description matching the term surfaces the group. The hit set is then
  // collapsed to the latest version by DISTINCT ON.
  let searchClause = "";
  if (filters.search) {
    params.push(`%${escapeSqlLike(filters.search)}%`);
    const i = params.length;
    searchClause = `AND e.version_group IN (
      SELECT version_group FROM element
       WHERE org_id = $1
         AND (name ILIKE $${i} OR code ILIKE $${i} OR description ILIKE $${i})
    )`;
  }

  const limitIdx = params.length + 1;
  const offsetIdx = params.length + 2;

  // Collapse versioned rows to the highest version_number per group, then
  // apply the filter. Elements with is_active=false on their latest version
  // are treated as archived even if older versions are active.
  const latestCte = `WITH latest AS (
    SELECT DISTINCT ON (version_group) e.*
      FROM element e
     WHERE e.org_id = $1 ${searchClause}
     ORDER BY e.version_group, e.version_number DESC
  )`;

  const sortKey = filters.sortBy ?? "code";
  const sortDir = filters.sortOrder === "desc" ? "DESC" : "ASC";
  const orderBy = `${ELEMENT_SORT_SQL[sortKey]} ${sortDir} NULLS LAST, e.code ASC`;

  const { rows } = await pool.query(
    `${latestCte}
     SELECT e.*, COUNT(*) OVER() AS total_count
       FROM latest e
      WHERE ${where}
      ORDER BY ${orderBy}
      LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
    [...params, limit, offset]
  );

  let total = rows.length > 0 ? Number(rows[0].total_count) : 0;
  // COUNT(*) OVER() returns no row when the page is past the end.
  // Fall back to a dedicated count so pagination still shows the true total.
  if (rows.length === 0 && page > 1) {
    const { rows: countRows } = await pool.query(
      `${latestCte}
       SELECT COUNT(*)::int AS total FROM latest e WHERE ${where}`,
      params
    );
    total = Number(countRows[0]?.total ?? 0);
  }

  // `total_count` is the windowed total from the count subquery — peeled off
  // and discarded; it lives on the response envelope instead.
  const elements: Element[] = rows.map((r) => {
    const { total_count, ...rest } = r;
    void total_count;
    return rest as Element;
  });
  return { rows: elements, total };
}

/**
 * Fetch a single element with its attributes and category breadcrumb.
 * Returns null if the element doesn't exist or belongs to another org.
 */
export async function getElementById(
  orgId: string,
  id: string
): Promise<ElementWithDetails | null> {
  const pool = getPool();

  const { rows } = await pool.query(
    `SELECT * FROM element WHERE id = $1 AND org_id = $2`,
    [id, orgId]
  );
  if (rows.length === 0) return null;
  const element = rows[0] as Element;

  const { rows: attrRows } = await pool.query(
    `SELECT * FROM element_attribute
      WHERE element_id = $1
      ORDER BY sort_order, attribute_key`,
    [id]
  );

  let categoryPath: string[] | null = null;
  if (element.category_id) {
    const { rows: pathRows } = await pool.query(
      `WITH RECURSIVE ancestors AS (
         SELECT id, name, parent_id, level FROM element_category WHERE id = $1
         UNION ALL
         SELECT c.id, c.name, c.parent_id, c.level
           FROM element_category c
           JOIN ancestors a ON c.id = a.parent_id
       )
       SELECT name FROM ancestors ORDER BY level ASC`,
      [element.category_id]
    );
    categoryPath = pathRows.map((r) => r.name as string);
  }

  return {
    ...element,
    attributes: attrRows as ElementAttribute[],
    category_path: categoryPath,
  };
}

/**
 * Fetch every version of an element's `version_group`, newest first.
 * Returns an empty array if the element doesn't exist or belongs to another
 * org — callers should treat empty as "not found".
 */
export async function getVersionHistory(
  orgId: string,
  elementId: string
): Promise<Element[]> {
  const pool = getPool();

  const { rows: anchorRows } = await pool.query(
    `SELECT version_group FROM element WHERE id = $1 AND org_id = $2`,
    [elementId, orgId]
  );
  if (anchorRows.length === 0) return [];
  const versionGroup = anchorRows[0].version_group as string;

  const { rows } = await pool.query(
    `SELECT * FROM element
      WHERE org_id = $1 AND version_group = $2
      ORDER BY version_number DESC`,
    [orgId, versionGroup]
  );
  return rows as Element[];
}

/** Internal: replace the attribute set for an element inside an open tx. */
async function replaceElementAttributes(
  client: { query: (text: string, params?: unknown[]) => Promise<unknown> },
  elementId: string,
  attributes: CreateElementInput["attributes"] | undefined
): Promise<void> {
  await client.query(`DELETE FROM element_attribute WHERE element_id = $1`, [
    elementId,
  ]);
  if (!attributes || attributes.length === 0) return;

  const values: unknown[] = [];
  const rows: string[] = [];
  attributes.forEach((attr, idx) => {
    const base = idx * 5;
    values.push(
      elementId,
      attr.attribute_key,
      attr.attribute_value,
      attr.unit ?? null,
      attr.sort_order ?? idx
    );
    rows.push(
      `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5})`
    );
  });

  await client.query(
    `INSERT INTO element_attribute
       (element_id, attribute_key, attribute_value, unit, sort_order)
     VALUES ${rows.join(", ")}`,
    values
  );
}

/**
 * Create an element + its attributes inside a transaction. The element must sit
 * under a Service Area; its code is that Service Area's path code plus a
 * per-prefix sequence. Throws "Category not found" or "Category must be a
 * Service Area".
 */
export async function createElement(
  orgId: string,
  createdBy: string,
  input: CreateElementInput
): Promise<ElementWithDetails> {
  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Validates the category and hands back its prefix in one query, so
    // generating the code costs no extra round-trip.
    const prefix = await requireServiceArea(client, orgId, input.categoryId);
    const code = await generateElementCode(client, orgId, prefix);

    let elementRow: Element;
    try {
      const { rows } = await client.query(
        `INSERT INTO element
           (org_id, code, name, description, category_id, unit, unit_cost,
            currency, material_cost, labour_cost, overhead_pct, service_charge_pct, margin_pct,
            client_rate, budget_rate,
            spec_reference, drawing_ref, tags, created_by,
            image_url, drawing_file_url, drawing_file_name,
            spec_file_url, spec_file_name)
         VALUES
           ($1, $2, $3, $4, $5, $6, $7,
            $8, $9, $10, $11, $12, $13,
            $14, $15,
            $16, $17, $18, $19,
            $20, $21, $22, $23, $24)
         RETURNING *`,
        [
          orgId,
          code,
          input.name,
          input.description ?? null,
          input.categoryId ?? null,
          input.unit,
          input.unitCost,
          input.currency ?? DEFAULT_CURRENCY,
          input.materialCost ?? null,
          input.labourCost ?? null,
          input.overheadPct ?? null,
          input.serviceChargePct ?? null,
          input.marginPct ?? null,
          input.clientRate ?? null,
          input.budgetRate ?? null,
          input.specReference ?? null,
          input.drawingRef ?? null,
          input.tags ?? null,
          createdBy,
          input.imageUrl ?? null,
          input.drawingFileUrl ?? null,
          input.drawingFileName ?? null,
          input.specFileUrl ?? null,
          input.specFileName ?? null,
        ]
      );
      elementRow = rows[0] as Element;
    } catch (err: unknown) {
      const pgErr = err as { code?: string };
      if (pgErr.code === "23503") throw new Error("Category not found");
      throw err;
    }

    await replaceElementAttributes(client, elementRow.id, input.attributes);

    const { rows: attrRows } = await client.query(
      `SELECT * FROM element_attribute
        WHERE element_id = $1
        ORDER BY sort_order, attribute_key`,
      [elementRow.id]
    );

    await client.query("COMMIT");
    return {
      ...elementRow,
      attributes: attrRows as ElementAttribute[],
      category_path: null,
    };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Update element fields + optionally replace attributes in one transaction.
 * Returns the updated element+attributes or null if not found in this org.
 *
 * `code` is not writable from the request body (it is absent from ELEMENT_COLS),
 * but moving an element to a different Service Area reissues it — see
 * `recodeForCategory`.
 */
export async function updateElement(
  orgId: string,
  id: string,
  input: UpdateElementInput
): Promise<ElementWithDetails | null> {
  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const updates: string[] = [];
    const values: unknown[] = [];
    // `push` returns the new length, which is the 1-based placeholder index —
    // so the counter can't drift out of step with the params array. Matches
    // `overwriteElementRow` below.
    const bind = (value: unknown) => `$${values.push(value)}`;

    for (const [key, col] of Object.entries(ELEMENT_COLS)) {
      const value = (input as Record<string, unknown>)[key];
      if (value !== undefined) updates.push(`"${col}" = ${bind(value)}`);
    }

    // A category change can reissue the code, so it is resolved before the
    // UPDATE and folded into the same statement — one write, no torn state
    // where the row points at a Service Area its code disagrees with.
    if (input.categoryId !== undefined) {
      const newCode = await recodeForCategory(
        client,
        orgId,
        id,
        input.categoryId
      );
      if (newCode) updates.push(`"code" = ${bind(newCode)}`);
    }

    let elementRow: Element | null = null;
    if (updates.length > 0) {
      updates.push(`updated_at = now()`);
      try {
        const { rows } = await client.query(
          `UPDATE element SET ${updates.join(", ")}
            WHERE id = ${bind(id)} AND org_id = ${bind(orgId)}
            RETURNING *`,
          values
        );
        elementRow = (rows[0] as Element) ?? null;
      } catch (err: unknown) {
        const pgErr = err as { code?: string };
        if (pgErr.code === "23503") throw new Error("Category not found");
        throw err;
      }
    } else {
      const { rows } = await client.query(
        `SELECT * FROM element WHERE id = $1 AND org_id = $2`,
        [id, orgId]
      );
      elementRow = (rows[0] as Element) ?? null;
    }

    if (!elementRow) {
      await client.query("ROLLBACK");
      return null;
    }

    if (input.attributes !== undefined) {
      await replaceElementAttributes(client, elementRow.id, input.attributes);
    }

    const { rows: attrRows } = await client.query(
      `SELECT * FROM element_attribute
        WHERE element_id = $1
        ORDER BY sort_order, attribute_key`,
      [elementRow.id]
    );

    await client.query("COMMIT");
    return {
      ...elementRow,
      attributes: attrRows as ElementAttribute[],
      category_path: null,
    };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Soft-delete (archive) an element group. Archives every version in the same
 * `version_group` so the listing (which collapses to latest) hides the element
 * and a later version-strategy import can't silently revive it by appending a
 * fresh active row.
 * Returns { deleted: false } if the element doesn't exist or every version is
 * already archived.
 */
export async function softDeleteElement(
  orgId: string,
  id: string
): Promise<{ deleted: boolean }> {
  const pool = getPool();
  const { rowCount } = await pool.query(
    `UPDATE element SET is_active = false, updated_at = now()
      WHERE org_id = $1
        AND version_group = (
          SELECT version_group FROM element
           WHERE id = $2 AND org_id = $1
        )
        AND is_active = true`,
    [orgId, id]
  );
  return { deleted: (rowCount ?? 0) > 0 };
}

/**
 * Restore a previously archived element group. Mirror of softDeleteElement —
 * operates on every row sharing the same `version_group` so the listing can
 * surface the element again.
 * Returns { restored: false } if the element doesn't exist or every version
 * is already active.
 */
export async function restoreElement(
  orgId: string,
  id: string
): Promise<{ restored: boolean }> {
  const pool = getPool();
  const { rowCount } = await pool.query(
    `UPDATE element SET is_active = true, updated_at = now()
      WHERE org_id = $1
        AND version_group = (
          SELECT version_group FROM element
           WHERE id = $2 AND org_id = $1
        )
        AND is_active = false`,
    [orgId, id]
  );
  return { restored: (rowCount ?? 0) > 0 };
}

/**
 * Duplicate an element (with its attributes). The copy gets the next code in
 * its category's sequence, same as a fresh element.
 */
export async function duplicateElement(
  orgId: string,
  createdBy: string,
  id: string
): Promise<ElementWithDetails | null> {
  const pool = getPool();

  const { rows: srcRows } = await pool.query(
    `SELECT * FROM element WHERE id = $1 AND org_id = $2`,
    [id, orgId]
  );
  if (srcRows.length === 0) return null;
  const src = srcRows[0] as Element;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    try {
      const newCode = await generateElementCodeFor(
        client,
        orgId,
        src.category_id
      );

      const {
        rows: [newRow],
      } = await client.query(
        `INSERT INTO element
           (org_id, code, name, description, category_id, unit, unit_cost,
            currency, material_cost, labour_cost, overhead_pct, service_charge_pct, margin_pct,
            client_rate, budget_rate,
            spec_reference, drawing_ref, tags, is_active, created_by,
            image_url, drawing_file_url, drawing_file_name,
            spec_file_url, spec_file_name)
         VALUES
           ($1, $2, $3, $4, $5, $6, $7,
            $8, $9, $10, $11, $12, $13,
            $14, $15,
            $16, $17, $18, true, $19,
            $20, $21, $22, $23, $24)
         RETURNING *`,
        [
          orgId,
          newCode,
          src.name,
          src.description,
          src.category_id,
          src.unit,
          src.unit_cost,
          src.currency,
          src.material_cost,
          src.labour_cost,
          src.overhead_pct,
          src.service_charge_pct,
          src.margin_pct,
          src.client_rate,
          src.budget_rate,
          src.spec_reference,
          src.drawing_ref,
          src.tags,
          createdBy,
          src.image_url,
          src.drawing_file_url,
          src.drawing_file_name,
          src.spec_file_url,
          src.spec_file_name,
        ]
      );

      await client.query(
        `INSERT INTO element_attribute
           (element_id, attribute_key, attribute_value, unit, sort_order)
         SELECT $1, attribute_key, attribute_value, unit, sort_order
           FROM element_attribute
          WHERE element_id = $2`,
        [newRow.id, src.id]
      );

      const { rows: attrRows } = await client.query(
        `SELECT * FROM element_attribute
          WHERE element_id = $1
          ORDER BY sort_order, attribute_key`,
        [newRow.id]
      );

      await client.query("COMMIT");
      return {
        ...(newRow as Element),
        attributes: attrRows as ElementAttribute[],
        category_path: null,
      };
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    }
  } finally {
    client.release();
  }
}

/**
 * List elements for export (no pagination). Used by F3 Excel export.
 * Hard-capped at 10k rows; `truncated` signals when the cap was hit so the
 * caller can surface a warning instead of silently shipping an incomplete file.
 */
export const ELEMENT_EXPORT_LIMIT = 10_000;

/** Streamed export source for the element library — capped at `ELEMENT_EXPORT_LIMIT` rows. */
export async function getElementsForExport(
  orgId: string,
  filters: Omit<ElementFilters, "page" | "limit"> = {}
): Promise<{ rows: Element[]; total: number; truncated: boolean }> {
  // Fetch LIMIT+1 to detect truncation without a COUNT. Only pay for the
  // dedicated count query when the result set actually hit the cap — most
  // exports are under 10k and skip the window aggregate entirely.
  const { rows } = await getElements(orgId, {
    ...filters,
    page: 1,
    limit: ELEMENT_EXPORT_LIMIT + 1,
  });

  if (rows.length <= ELEMENT_EXPORT_LIMIT) {
    return { rows, total: rows.length, truncated: false };
  }

  const capped = rows.slice(0, ELEMENT_EXPORT_LIMIT);
  const total = await countElements(orgId, filters);
  return { rows: capped, total, truncated: true };
}

/**
 * Standalone COUNT for the export path. Mirrors `getElements`' latest-version
 * collapse + WHERE clause so the total matches what the user would see in
 * the UI list.
 */
async function countElements(
  orgId: string,
  filters: Omit<ElementFilters, "page" | "limit"> = {}
): Promise<number> {
  const pool = getPool();
  const { where, params } = buildElementWhere(orgId, filters);

  let searchClause = "";
  if (filters.search) {
    params.push(`%${escapeSqlLike(filters.search)}%`);
    const i = params.length;
    searchClause = `AND e.version_group IN (
      SELECT version_group FROM element
       WHERE org_id = $1
         AND (name ILIKE $${i} OR code ILIKE $${i} OR description ILIKE $${i})
    )`;
  }

  const { rows } = await pool.query<{ total: number }>(
    `WITH latest AS (
       SELECT DISTINCT ON (version_group) e.*
         FROM element e
        WHERE e.org_id = $1 ${searchClause}
        ORDER BY e.version_group, e.version_number DESC
     )
     SELECT COUNT(*)::int AS total FROM latest e WHERE ${where}`,
    params
  );
  return Number(rows[0]?.total ?? 0);
}

// ---------------------------------------------------------------------------
// Element bulk import (F3)
// ---------------------------------------------------------------------------

export type ElementDuplicateStrategy = "skip" | "overwrite" | "version";

/**
 * A single row to upsert — matches the shape emitted by the Excel parser.
 * `categoryPath` is resolved against the org's category tree inside the
 * transaction; unresolvable paths land in `failed`.
 */
export interface BulkElementRow {
  rowNumber: number;
  /** Blank means "assign one" — such a row is always a fresh insert. */
  code?: string;
  name: string;
  description?: string;
  /** Required, and must name a Service Area. */
  categoryPath: string[];
  unit: string;
  unitCost: number;
  currency?: string;
  materialCost?: number;
  labourCost?: number;
  overheadPct?: number;
  serviceChargePct?: number;
  marginPct?: number;
  clientRate?: number | null;
  budgetRate?: number | null;
  specReference?: string;
  drawingRef?: string;
  tags?: string[];
}

export interface BulkElementImportInput {
  strategy: ElementDuplicateStrategy;
  createdBy: string;
  rows: BulkElementRow[];
}

export interface BulkElementImportResult {
  inserted: number;
  updated: number;
  skipped: number;
  versioned: number;
  failed: Array<{ rowNumber: number; code: string; error: string }>;
}

type PgClientLike = {
  query<T = unknown>(
    text: string,
    params?: unknown[]
  ): Promise<{ rows: T[]; rowCount?: number | null }>;
};

/**
 * Take a transaction-scoped advisory lock keyed on (org_id, code) so that
 * concurrent writers serialise before the SELECT → INSERT/UPDATE window that
 * enforces code uniqueness. Released automatically at COMMIT/ROLLBACK.
 */
async function lockElementCode(
  client: PgClientLike,
  orgId: string,
  code: string
): Promise<void> {
  await client.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [
    `element:${orgId}:${code}`,
  ]);
}

/**
 * Assign an element its code: the category's path code (`KIT-CAB-BASE`, or
 * `GEN` when uncategorized) plus a 4-digit per-prefix sequence.
 *
 * Runs inside the caller's transaction, so a ROLLBACK gives the number back
 * instead of leaving a hole. The candidate is checked under the same advisory
 * lock the import uses, so a generated code can't collide with a concurrently
 * imported one.
 *
 * A collision means the counter has fallen behind the rows — the import inserts
 * the codes it is given verbatim and never advances it. Re-derive the true
 * high-water mark and take the next number after it. That has to happen inside
 * this transaction: a rollback would otherwise undo the counter bump too, and
 * every later create in the category would fail identically.
 */
async function generateElementCode(
  client: PoolClient,
  orgId: string,
  prefix: string
): Promise<string> {
  for (let attempt = 0; attempt < 2; attempt++) {
    // Second pass: the counter has fallen behind the rows, so re-derive it.
    if (attempt === 1) await syncElementCounter(client, orgId, prefix);

    const [candidate] = await nextElementCodes(client, orgId, prefix, 1);
    await lockElementCode(client, orgId, candidate);
    const { rows } = await client.query(
      `SELECT 1 FROM element WHERE org_id = $1 AND code = $2 LIMIT 1`,
      [orgId, candidate]
    );
    if (rows.length === 0) return candidate;
  }

  // The counter is now past every `<prefix>-<digits>` row, so a second
  // collision can't come from stale data — only from a concurrent writer that
  // committed a literal code in the microseconds between. Not worth spinning on.
  throw new Error(`Could not generate a free element code for ${prefix}`);
}

/**
 * Resolve the category's prefix, then generate. Used by `duplicateElement`,
 * which copies the source's category — and that may be a grandfathered NULL, so
 * this tolerates what `requireServiceArea` rejects.
 */
async function generateElementCodeFor(
  client: PoolClient,
  orgId: string,
  categoryId: string | null | undefined
): Promise<string> {
  const prefix = await elementCodePrefix(client, orgId, categoryId);
  return generateElementCode(client, orgId, prefix);
}

/**
 * Reissue an element's code when a category change has made it stale.
 *
 * A code is only true if it names the Service Area the element sits under, so
 * moving `GEN-0001` (or the legacy `LGT-0001`) under Base Cabinets must yield
 * `KIT-CAB-BASE-####`. Returns null when the code already sits under the new
 * category's prefix — re-saving an element that hasn't moved must not burn a
 * sequence number or churn the code.
 *
 * This is the one path that writes `code` after creation; it stays out of
 * ELEMENT_COLS so it can never be driven from the request body.
 */
async function recodeForCategory(
  client: PoolClient,
  orgId: string,
  id: string,
  categoryId: string
): Promise<string | null> {
  const prefix = await requireServiceArea(client, orgId, categoryId);

  const { rows } = await client.query<{ code: string }>(
    `SELECT code FROM element WHERE id = $1 AND org_id = $2`,
    [id, orgId]
  );
  const current = rows[0]?.code;
  if (current?.startsWith(`${prefix}-`)) return null;

  return generateElementCode(client, orgId, prefix);
}

/**
 * Look up the latest version of an element by code within an org. Caller is
 * expected to have taken `lockElementCode` first when the lookup is followed
 * by a write — the `FOR UPDATE` is belt-and-braces for the version_number
 * race.
 */
async function findLatestByCode(
  client: PgClientLike,
  orgId: string,
  code: string
): Promise<{
  id: string;
  versionGroup: string;
  versionNumber: number;
} | null> {
  const { rows } = await client.query<{
    id: string;
    version_group: string;
    version_number: number;
  }>(
    `SELECT id, version_group, version_number
       FROM element
      WHERE org_id = $1 AND code = $2
      ORDER BY version_number DESC
      LIMIT 1
      FOR UPDATE`,
    [orgId, code]
  );
  if (rows.length === 0) return null;
  const r = rows[0];
  return {
    id: r.id,
    versionGroup: r.version_group,
    versionNumber: r.version_number,
  };
}

/**
 * Try to insert a brand-new element (version 1 of a fresh group). Returns
 * null if a row with the same code already exists in the org — the caller
 * then decides whether to skip, overwrite, or append a new version.
 */
async function tryInsertElementRow(
  client: PgClientLike,
  orgId: string,
  createdBy: string,
  code: string,
  row: BulkElementRow,
  categoryId: string | null
): Promise<string | null> {
  // Caller has already taken `lockElementCode` for this (orgId, code) inside
  // the outer transaction, so the SELECT → INSERT window is race-free.
  const existing = await findLatestByCode(client, orgId, code);
  if (existing) return null;

  const { rows } = await client.query<{ id: string }>(
    `INSERT INTO element
       (org_id, code, name, description, category_id, unit, unit_cost,
        currency, material_cost, labour_cost, overhead_pct, service_charge_pct, margin_pct,
        client_rate, budget_rate,
        spec_reference, drawing_ref, tags, created_by)
     VALUES
       ($1, $2, $3, $4, $5, $6, $7,
        $8, $9, $10, $11, $12, $13,
        $14, $15,
        $16, $17, $18, $19)
     RETURNING id`,
    [
      orgId,
      code,
      row.name,
      row.description ?? null,
      categoryId,
      row.unit,
      row.unitCost,
      row.currency ?? DEFAULT_CURRENCY,
      row.materialCost ?? null,
      row.labourCost ?? null,
      row.overheadPct ?? null,
      row.serviceChargePct ?? null,
      row.marginPct ?? null,
      row.clientRate ?? null,
      row.budgetRate ?? null,
      row.specReference ?? null,
      row.drawingRef ?? null,
      row.tags && row.tags.length > 0 ? row.tags : null,
      createdBy,
    ]
  );
  return rows[0].id;
}

/**
 * Insert a new version into an existing group. `versionGroup` + `nextVersion`
 * come from the previously-found latest row — bulkUpsertElements computes them
 * together so concurrent callers in the same request share a consistent view.
 *
 * Optional fields absent from `row` inherit from the previous latest row —
 * "blank cell in sheet = leave alone" — matching the overwrite strategy's
 * semantics. Required fields (name, unit, unitCost) always take the new value.
 */
async function insertElementVersion(
  client: PgClientLike,
  orgId: string,
  createdBy: string,
  code: string,
  row: BulkElementRow,
  categoryId: string,
  versionGroup: string,
  nextVersion: number,
  prevLatestId: string
): Promise<string> {
  // Fetch the prev row's optional fields so blank cells inherit instead of
  // getting silently nulled. Also doubles as the org-guard: the row is
  // scoped by orgId via the outer findLatestByCode, so an existing row
  // means the group belongs to this org.
  const { rows: prevRows } = await client.query<{
    description: string | null;
    category_id: string | null;
    currency: string;
    material_cost: string | null;
    labour_cost: string | null;
    overhead_pct: string | null;
    service_charge_pct: string | null;
    margin_pct: string | null;
    client_rate: string | null;
    budget_rate: string | null;
    spec_reference: string | null;
    drawing_ref: string | null;
    tags: string[] | null;
  }>(
    `SELECT description, category_id, currency, material_cost, labour_cost,
            overhead_pct, service_charge_pct, margin_pct,
            client_rate, budget_rate,
            spec_reference, drawing_ref, tags
       FROM element
      WHERE id = $1 AND org_id = $2`,
    [prevLatestId, orgId]
  );
  if (prevRows.length === 0) {
    throw new Error("Previous version row not found");
  }
  const prev = prevRows[0];

  const { rows } = await client.query<{ id: string }>(
    `INSERT INTO element
       (org_id, code, name, description, category_id, unit, unit_cost,
        currency, material_cost, labour_cost, overhead_pct, service_charge_pct, margin_pct,
        client_rate, budget_rate,
        spec_reference, drawing_ref, tags, created_by,
        version_group, version_number)
     VALUES
       ($1, $2, $3, $4, $5, $6, $7,
        $8, $9, $10, $11, $12, $13,
        $14, $15,
        $16, $17, $18, $19,
        $20, $21)
     RETURNING id`,
    [
      orgId,
      code,
      row.name,
      row.description ?? prev.description,
      categoryId,
      row.unit,
      row.unitCost,
      row.currency ?? prev.currency,
      row.materialCost ?? prev.material_cost,
      row.labourCost ?? prev.labour_cost,
      row.overheadPct ?? prev.overhead_pct,
      row.serviceChargePct ?? prev.service_charge_pct,
      row.marginPct ?? prev.margin_pct,
      row.clientRate ?? prev.client_rate,
      row.budgetRate ?? prev.budget_rate,
      row.specReference ?? prev.spec_reference,
      row.drawingRef ?? prev.drawing_ref,
      row.tags && row.tags.length > 0 ? row.tags : prev.tags,
      createdBy,
      versionGroup,
      nextVersion,
    ]
  );
  const newId = rows[0].id;

  // Preserve attributes from the prior latest version. Excel import has no
  // column for attributes, so without this copy every version-strategy import
  // would silently drop the attribute set attached to the prior latest row.
  await client.query(
    `INSERT INTO element_attribute
       (element_id, attribute_key, attribute_value, unit, sort_order)
     SELECT $1, attribute_key, attribute_value, unit, sort_order
       FROM element_attribute
      WHERE element_id = $2`,
    [newId, prevLatestId]
  );

  return newId;
}

/** Dynamic UPDATE — only overwrite columns that are present in the row. */
async function overwriteElementRow(
  client: PgClientLike,
  orgId: string,
  code: string,
  row: BulkElementRow,
  categoryId: string
): Promise<boolean> {
  const updates: string[] = [];
  const params: unknown[] = [];
  const push = (col: string, value: unknown) => {
    params.push(value);
    updates.push(`${col} = $${params.length}`);
  };

  // Required-always columns (always present in a parsed row).
  push("name", row.name);
  push("unit", row.unit);
  push("unit_cost", row.unitCost);

  // Every row names a Service Area now, so there is no "leave the category
  // alone" case left — a blank path is a hard row failure upstream.
  push("category_id", categoryId);

  // Optional columns — only overwrite when present.
  if (row.description !== undefined) push("description", row.description);
  if (row.currency !== undefined) push("currency", row.currency);
  if (row.materialCost !== undefined) push("material_cost", row.materialCost);
  if (row.labourCost !== undefined) push("labour_cost", row.labourCost);
  if (row.overheadPct !== undefined) push("overhead_pct", row.overheadPct);
  if (row.serviceChargePct !== undefined)
    push("service_charge_pct", row.serviceChargePct);
  if (row.marginPct !== undefined) push("margin_pct", row.marginPct);
  if (row.clientRate !== undefined) push("client_rate", row.clientRate);
  if (row.budgetRate !== undefined) push("budget_rate", row.budgetRate);
  if (row.specReference !== undefined)
    push("spec_reference", row.specReference);
  if (row.drawingRef !== undefined) push("drawing_ref", row.drawingRef);
  if (row.tags !== undefined && row.tags.length > 0) push("tags", row.tags);

  updates.push(`updated_at = now()`);

  // Overwrite only the *latest* version of a code group — older versions are
  // historical and must stay immutable.
  params.push(orgId, code);
  const orgIdx = params.length - 1;
  const codeIdx = params.length;

  const { rows } = await client.query(
    `UPDATE element SET ${updates.join(", ")}
      WHERE id = (
        SELECT id FROM element
         WHERE org_id = $${orgIdx} AND code = $${codeIdx}
         ORDER BY version_number DESC
         LIMIT 1
      )
      RETURNING id`,
    params
  );
  return rows.length > 0;
}

/**
 * Batch size for bulk imports. Kept at/under PostgreSQL's per-transaction
 * subtransaction cache threshold (~64 savepoints) so the per-row SAVEPOINTs
 * stay in memory instead of spilling to disk, and the pool connection isn't
 * pinned for 10k-row runs.
 */
const BULK_IMPORT_BATCH_SIZE = 64;

/**
 * Bulk-upsert elements from an import. Splits `input.rows` into batches,
 * each its own transaction with per-row savepoints so one bad row doesn't
 * doom the batch. Aggregates success/failure counters across batches.
 */
export async function bulkUpsertElements(
  orgId: string,
  input: BulkElementImportInput
): Promise<BulkElementImportResult> {
  const pool = getPool();
  const result = emptyImportResult();

  // One fetch serves all three lookups: the path → id map, the id → code_prefix
  // map that codes a row, and the id → level map that rejects a row filed under
  // anything but a Service Area. Doing it per-row would re-SELECT the same
  // category thousands of times.
  const { rows: catRows } = await pool.query(
    `SELECT id, name, parent_id, code_prefix, level
       FROM element_category
      WHERE org_id = $1 AND is_active = true`,
    [orgId]
  );
  const rows = catRows as Array<
    Pick<ElementCategory, "id" | "name" | "parent_id" | "code_prefix" | "level">
  >;
  const categories: CategoryLookup = {
    idByPath: buildCategoryPathMap(rows),
    prefixById: new Map(rows.map((c) => [c.id, c.code_prefix?.trim() || null])),
    levelById: buildCategoryLevelMap(rows),
  };

  for (let i = 0; i < input.rows.length; i += BULK_IMPORT_BATCH_SIZE) {
    const batch = input.rows.slice(i, i + BULK_IMPORT_BATCH_SIZE);
    const batchResult = await runBulkImportBatchWithRetry(
      pool,
      orgId,
      input,
      batch,
      categories
    );
    result.inserted += batchResult.inserted;
    result.updated += batchResult.updated;
    result.skipped += batchResult.skipped;
    result.versioned += batchResult.versioned;
    result.failed.push(...batchResult.failed);
  }

  return result;
}

function emptyImportResult(): BulkElementImportResult {
  return { inserted: 0, updated: 0, skipped: 0, versioned: 0, failed: [] };
}

/**
 * The org's category tree, resolved once per import instead of per row:
 * `idByPath` maps a row's "A > B > C" to a category id, `prefixById` maps that
 * id to the path code a generated element code is built from.
 */
interface CategoryLookup {
  idByPath: Map<string, string>;
  prefixById: Map<string, string | null>;
  levelById: Map<string, number>;
}

/**
 * Aborts worth one retry: a serialization failure (40001) or a deadlock
 * (40P01). Both mean "a concurrent writer got in the way", not "this batch is
 * wrong", and both leave the batch's transaction fully rolled back.
 *
 * The deadlock is reachable because the two code paths take their locks in
 * opposite orders: generating a code advances `sequence_counter` (holding that
 * row until COMMIT) and *then* takes the advisory lock on the candidate, while
 * a row that carries its own code takes the advisory lock without ever touching
 * the counter. Two concurrent imports — one generating, one supplying a literal
 * code that happens to match the number about to be generated — can therefore
 * wait on each other. Vanishingly rare, and Postgres breaks it for us; retrying
 * the aborted batch is the whole fix.
 */
const RETRYABLE_BATCH_ERRORS = new Set(["40001", "40P01"]);

function isRetryableAbort(err: unknown): boolean {
  const code = (err as { code?: string } | null)?.code;
  return !!code && RETRYABLE_BATCH_ERRORS.has(code);
}

/**
 * Run a single batch, retrying once on a retryable abort. A second retry on top
 * of that is already fighting pool contention, so we surface the error instead.
 *
 * Each attempt tallies into its own result, which is only merged by the caller
 * once the batch commits. An aborted attempt rolls its rows back in the DB, so
 * counting the work it did before the abort would inflate the totals the user
 * is shown — and those totals get cached by the idempotency layer.
 */
async function runBulkImportBatchWithRetry(
  pool: ReturnType<typeof getPool>,
  orgId: string,
  input: BulkElementImportInput,
  rows: BulkElementRow[],
  categories: CategoryLookup
): Promise<BulkElementImportResult> {
  try {
    return await runBulkImportBatch(pool, orgId, input, rows, categories);
  } catch (err) {
    if (!isRetryableAbort(err)) throw err;
    logger.warn("bulk import batch aborted by a concurrent writer; retrying", {
      orgId,
      rows: rows.length,
      pgCode: (err as { code?: string }).code,
    });
    return await runBulkImportBatch(pool, orgId, input, rows, categories);
  }
}

async function runBulkImportBatch(
  pool: ReturnType<typeof getPool>,
  orgId: string,
  input: BulkElementImportInput,
  rows: BulkElementRow[],
  categories: CategoryLookup
): Promise<BulkElementImportResult> {
  const result = emptyImportResult();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    for (const row of rows) {
      const path = row.categoryPath ?? [];
      const key = path.map(normalizeCategorySegment).join(" > ");
      const categoryId = categories.idByPath.get(key);

      if (!categoryId) {
        result.failed.push({
          rowNumber: row.rowNumber,
          code: row.code ?? "",
          error: `Category path not found: ${path.join(" > ")}`,
        });
        continue;
      }

      // The schema can require a path but not that it names a Service Area —
      // only the org's tree knows that, and this is the import's one chance to
      // say so before the row is written.
      if (categories.levelById.get(categoryId) !== SERVICE_AREA_LEVEL) {
        result.failed.push({
          rowNumber: row.rowNumber,
          code: row.code ?? "",
          error: notAServiceAreaError(path),
        });
        continue;
      }

      // Per-row savepoint — isolates any unexpected DB error (FK violation,
      // check constraint, etc.) so a single bad row does not invalidate the
      // outer transaction and doom every subsequent row.
      await client.query("SAVEPOINT bulk_row");
      try {
        let code = row.code;
        if (code === undefined) {
          // No code means no join key, so the row can't match an existing
          // element — it is unambiguously new and gets a generated one. The
          // prefix comes from the map built up front, not a per-row SELECT.
          // generateElementCode already took the advisory lock on the code it
          // handed back, and holds it to COMMIT.
          const prefix =
            categories.prefixById.get(categoryId) ?? UNCATEGORIZED_PREFIX;
          code = await generateElementCode(client, orgId, prefix);
        } else {
          // Advisory lock per (orgId, code) — covers every strategy's SELECT →
          // INSERT/UPDATE window. Concurrent imports of the same code
          // serialise here instead of racing to the DB.
          await lockElementCode(client, orgId, code);
        }

        const insertedId = await tryInsertElementRow(
          client,
          orgId,
          input.createdBy,
          code,
          row,
          categoryId
        );
        if (insertedId) {
          result.inserted++;
        } else if (input.strategy === "skip") {
          result.skipped++;
        } else if (input.strategy === "overwrite") {
          const updated = await overwriteElementRow(
            client,
            orgId,
            code,
            row,
            categoryId
          );
          if (updated) result.updated++;
          else
            result.failed.push({
              rowNumber: row.rowNumber,
              code,
              error: "Update failed — no matching row",
            });
        } else {
          // strategy === "version": append a new version_number onto the
          // existing group. Code stays identical across versions.
          const latest = await findLatestByCode(client, orgId, code);
          if (!latest) {
            result.failed.push({
              rowNumber: row.rowNumber,
              code,
              error: "Version failed — no existing element with this code",
            });
          } else {
            await insertElementVersion(
              client,
              orgId,
              input.createdBy,
              code,
              row,
              categoryId,
              latest.versionGroup,
              latest.versionNumber + 1,
              latest.id
            );
            result.versioned++;
          }
        }
        await client.query("RELEASE SAVEPOINT bulk_row");
      } catch (err: unknown) {
        // Aborts caused by a concurrent writer propagate to the batch retry
        // wrapper — do not swallow them into failed[]. Every lock this row can
        // wait on is taken inside this try, so a deadlock surfaces here rather
        // than at the batch level. Everything else is a per-row bug (FK
        // violation, check constraint, …).
        if (isRetryableAbort(err)) throw err;

        const pgErr = err as { code?: string; message?: string };
        await client.query("ROLLBACK TO SAVEPOINT bulk_row");
        const userMessage = mapPgError(pgErr);
        logger.error("element import row failed", {
          orgId,
          rowNumber: row.rowNumber,
          code: row.code,
          pgCode: pgErr.code,
          pgMessage: pgErr.message,
          error: userMessage,
        });
        result.failed.push({
          rowNumber: row.rowNumber,
          code: row.code ?? "",
          error: userMessage,
        });
      }
    }

    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

// ---------------------------------------------------------------------------
// Element import idempotency (F3) — cross-replica cache for the confirm route
// ---------------------------------------------------------------------------

const IMPORT_IDEMPOTENCY_TTL_MS = 10 * 60 * 1000;

/**
 * Execute `run` and cache its result under `key` so that a replay of the
 * same (orgId, userId, strategy, rowsHash) within 10 minutes returns the
 * original result instead of double-committing.
 *
 * Serialisation: a session-level `pg_advisory_lock` around the read-check-
 * write window means two replicas calling concurrently with the same key
 * queue on each other; the second call sees the first call's cached result
 * and skips the import entirely.
 *
 * Storage: rows live in `element_import_idempotency` (see
 * `scripts/migrate-element-import-idempotency.sql`). Entries older than
 * TTL are opportunistically pruned on every write.
 */
export async function withImportIdempotency(
  key: string,
  run: () => Promise<BulkElementImportResult>
): Promise<{ result: BulkElementImportResult; replayed: boolean }> {
  const pool = getPool();
  const client = await pool.connect();
  let locked = false;
  try {
    // `hashtext` is int4 and deterministic; perfect match for advisory-lock
    // serialisation keyed on an arbitrary string.
    await client.query(`SELECT pg_advisory_lock(hashtext($1::text))`, [key]);
    locked = true;

    const { rows: cached } = await client.query<{
      result: BulkElementImportResult;
    }>(
      `SELECT result FROM element_import_idempotency
        WHERE key = $1
          AND created_at > now() - ($2::bigint || ' milliseconds')::interval
        LIMIT 1`,
      [key, IMPORT_IDEMPOTENCY_TTL_MS]
    );
    if (cached.length > 0) {
      return { result: cached[0].result, replayed: true };
    }

    const result = await run();

    // Persist — ON CONFLICT covers a different replica having written first
    // while we held the lock (shouldn't happen under advisory-lock, but is
    // the correct behaviour if it ever does: last write wins, not a crash).
    await client.query(
      `INSERT INTO element_import_idempotency (key, result) VALUES ($1, $2::jsonb)
       ON CONFLICT (key) DO UPDATE SET result = EXCLUDED.result, created_at = now()`,
      [key, JSON.stringify(result)]
    );

    // Opportunistic cleanup — LIMIT keeps the DELETE short enough that
    // the advisory lock hold time stays bounded even with a backlog.
    await client.query(
      `DELETE FROM element_import_idempotency
        WHERE key IN (
          SELECT key FROM element_import_idempotency
           WHERE created_at < now() - ($1::bigint || ' milliseconds')::interval
           LIMIT 100
        )`,
      [IMPORT_IDEMPOTENCY_TTL_MS]
    );

    return { result, replayed: false };
  } finally {
    if (locked) {
      try {
        await client.query(`SELECT pg_advisory_unlock(hashtext($1::text))`, [
          key,
        ]);
      } catch (err) {
        logger.warn("failed to release import idempotency advisory lock", {
          key,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
    client.release();
  }
}
