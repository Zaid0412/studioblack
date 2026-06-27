import { getPool } from "@/lib/db";
import type { VendorCategory, VendorCategoryNode } from "@/types";

/**
 * Vendor category tree — a SEPARATE taxonomy from element categories
 * (see docs/vendor-taxonomy-plan.md). Mirrors the element-category queries;
 * the column for the short taxonomy code is `code` (vs element's `code_prefix`).
 */

/** Build a nested tree from flat vendor-category rows. */
export function buildVendorCategoryTree(
  rows: VendorCategory[]
): VendorCategoryNode[] {
  const map = new Map<string, VendorCategoryNode>();
  const roots: VendorCategoryNode[] = [];

  for (const row of rows) {
    map.set(row.id, { ...row, children: [] });
  }

  for (const node of map.values()) {
    if (node.parent_id && map.has(node.parent_id)) {
      map.get(node.parent_id)!.children.push(node);
    } else if (!node.parent_id) {
      roots.push(node);
    }
  }

  return roots;
}

/** Fetch all vendor categories for an org, ordered for tree assembly. */
export async function getVendorCategoryTree(orgId: string) {
  const pool = getPool();
  const { rows } = await pool.query(
    `SELECT * FROM vendor_category
     WHERE org_id = $1
     ORDER BY level, sort_order, name`,
    [orgId]
  );
  return rows as VendorCategory[];
}

/**
 * Create a vendor category. Level is derived from the parent in a single
 * INSERT; depth is capped at 3 (mirrors element_category creation).
 */
export async function createVendorCategory(
  orgId: string,
  input: {
    name: string;
    parentId?: string;
    code?: string;
    sortOrder?: number;
    icon?: string;
    color?: string;
  }
) {
  const pool = getPool();
  const parentId = input.parentId ?? null;

  let rows: VendorCategory[];
  try {
    const result = await pool.query(
      `INSERT INTO vendor_category (org_id, name, parent_id, level, code, sort_order, icon, color)
       SELECT $1, $2, $3,
         CASE WHEN $3::uuid IS NULL THEN 1
              ELSE (SELECT level + 1 FROM vendor_category WHERE id = $3)
         END,
         $4, COALESCE($5::int, (
           SELECT COALESCE(MAX(sort_order), -1) + 1
           FROM vendor_category
           WHERE org_id = $1 AND parent_id IS NOT DISTINCT FROM $3
         )), $6, $7
       WHERE ($3::uuid IS NULL OR EXISTS (
         SELECT 1 FROM vendor_category WHERE id = $3 AND level < 3
       ))
       RETURNING *`,
      [
        orgId,
        input.name,
        parentId,
        input.code ?? null,
        input.sortOrder ?? null,
        input.icon ?? null,
        input.color ?? null,
      ]
    );
    rows = result.rows;
  } catch (err: unknown) {
    const pgErr = err as { code?: string };
    if (pgErr.code === "23514")
      throw new Error("Maximum nesting depth reached");
    if (pgErr.code === "23503") throw new Error("Parent category not found");
    throw err;
  }

  if (rows.length === 0) {
    if (parentId) {
      const { rows: check } = await pool.query(
        `SELECT level FROM vendor_category WHERE id = $1`,
        [parentId]
      );
      if (check.length === 0) throw new Error("Parent category not found");
      throw new Error("Maximum nesting depth reached");
    }
    throw new Error("Failed to create category");
  }

  return rows[0] as VendorCategory;
}

const VENDOR_CATEGORY_COLS = new Set([
  "name",
  "code",
  "sort_order",
  "icon",
  "color",
  "is_active",
]);

/**
 * Update a vendor category's fields. Expects snake_case keys (route handler
 * converts). Returns null if the category doesn't exist or no fields to update.
 */
export async function updateVendorCategory(
  id: string,
  orgId: string,
  fields: Record<string, unknown>
) {
  const updates: string[] = [];
  const values: unknown[] = [];
  let idx = 1;

  for (const [col, value] of Object.entries(fields)) {
    if (value !== undefined && VENDOR_CATEGORY_COLS.has(col)) {
      updates.push(`"${col}" = $${idx}`);
      values.push(value === "" ? null : value);
      idx++;
    }
  }

  if (updates.length === 0) return null;

  updates.push(`updated_at = now()`);
  values.push(id, orgId);

  const pool = getPool();
  const { rows } = await pool.query(
    `UPDATE vendor_category SET ${updates.join(", ")} WHERE id = $${idx} AND org_id = $${idx + 1} RETURNING *`,
    values
  );
  return (rows[0] as VendorCategory) ?? null;
}

/**
 * Delete a vendor category atomically. Returns not_found/has_children/deleted.
 * Single conditional DELETE — no TOCTOU race.
 */
export async function deleteVendorCategory(id: string, orgId: string) {
  const pool = getPool();

  const { rowCount } = await pool.query(
    `DELETE FROM vendor_category
     WHERE id = $1 AND org_id = $2
       AND NOT EXISTS (SELECT 1 FROM vendor_category WHERE parent_id = $1)`,
    [id, orgId]
  );

  if ((rowCount ?? 0) > 0) return { deleted: true as const };

  const { rows } = await pool.query(
    `SELECT EXISTS (SELECT 1 FROM vendor_category WHERE parent_id = $1) AS has_children`,
    [id]
  );
  if (rows[0]?.has_children) {
    return {
      deleted: false as const,
      error: "Category has children. Remove or move them first.",
    };
  }
  return { deleted: false as const, error: "Category not found" };
}
