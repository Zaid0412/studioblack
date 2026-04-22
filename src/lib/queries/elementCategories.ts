import { getPool } from "@/lib/db";
import type { ElementCategory, ElementCategoryNode } from "@/types";

/** Build a nested tree from flat category rows. */
export function buildCategoryTree(
  rows: ElementCategory[]
): ElementCategoryNode[] {
  const map = new Map<string, ElementCategoryNode>();
  const roots: ElementCategoryNode[] = [];

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

/**
 * Fetch all categories for an org with a per-node element count, ordered
 * for tree assembly. `element_count` covers the node's direct elements
 * (archived included) — aggregate for subtree counts client-side.
 */
export async function getCategoryTree(orgId: string) {
  const pool = getPool();
  const { rows } = await pool.query(
    `SELECT c.*, COALESCE(e.cnt, 0)::int AS element_count
     FROM element_category c
     LEFT JOIN (
       SELECT category_id, COUNT(*)::int AS cnt
       FROM element
       WHERE org_id = $1 AND category_id IS NOT NULL
       GROUP BY category_id
     ) e ON e.category_id = c.id
     WHERE c.org_id = $1
     ORDER BY c.level, c.sort_order, c.name`,
    [orgId]
  );
  return rows as (ElementCategory & { element_count: number })[];
}

/** Fetch a single category by ID. */
export async function getCategoryById(id: string) {
  const pool = getPool();
  const { rows } = await pool.query(
    `SELECT * FROM element_category WHERE id = $1`,
    [id]
  );
  return (rows[0] as ElementCategory) ?? null;
}

/**
 * Create a new category. Level is derived from parent via a single INSERT
 * with subqueries (no extra round-trips for parent lookup or sort_order).
 */
export async function createCategory(
  orgId: string,
  input: {
    name: string;
    parentId?: string;
    codePrefix?: string;
    sortOrder?: number;
    icon?: string;
    color?: string;
  }
) {
  const pool = getPool();
  const parentId = input.parentId ?? null;

  // Single query: derive level from parent, auto-increment sort_order if not given
  let rows: ElementCategory[];
  try {
    const result = await pool.query(
      `INSERT INTO element_category (org_id, name, parent_id, level, code_prefix, sort_order, icon, color)
       SELECT $1, $2, $3,
         CASE WHEN $3::uuid IS NULL THEN 1
              ELSE (SELECT level + 1 FROM element_category WHERE id = $3)
         END,
         $4, COALESCE($5::int, (
           SELECT COALESCE(MAX(sort_order), -1) + 1
           FROM element_category
           WHERE org_id = $1 AND parent_id IS NOT DISTINCT FROM $3
         )), $6, $7
       WHERE ($3::uuid IS NULL OR EXISTS (
         SELECT 1 FROM element_category WHERE id = $3 AND level < 3
       ))
       RETURNING *`,
      [
        orgId,
        input.name,
        parentId,
        input.codePrefix ?? null,
        input.sortOrder ?? null,
        input.icon ?? null,
        input.color ?? null,
      ]
    );
    rows = result.rows;
  } catch (err: unknown) {
    // Handle DB constraint violations (e.g., chk_parent_level race condition)
    const pgErr = err as { code?: string };
    if (pgErr.code === "23514")
      throw new Error("Maximum nesting depth reached");
    if (pgErr.code === "23503") throw new Error("Parent category not found");
    throw err;
  }

  if (rows.length === 0) {
    // The WHERE clause filtered out — either parent not found or max depth exceeded
    if (parentId) {
      const { rows: check } = await pool.query(
        `SELECT level FROM element_category WHERE id = $1`,
        [parentId]
      );
      if (check.length === 0) throw new Error("Parent category not found");
      throw new Error("Maximum nesting depth reached");
    }
    throw new Error("Failed to create category");
  }

  return rows[0] as ElementCategory;
}

const CATEGORY_COLS = new Set([
  "name",
  "code_prefix",
  "sort_order",
  "icon",
  "color",
  "is_active",
]);

/**
 * Update a category's fields. Expects snake_case keys (route handler converts).
 * Returns null if the category doesn't exist or no fields to update.
 */
export async function updateCategory(
  id: string,
  orgId: string,
  fields: Record<string, unknown>
) {
  const updates: string[] = [];
  const values: unknown[] = [];
  let idx = 1;

  for (const [col, value] of Object.entries(fields)) {
    if (value !== undefined && CATEGORY_COLS.has(col)) {
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
    `UPDATE element_category SET ${updates.join(", ")} WHERE id = $${idx} AND org_id = $${idx + 1} RETURNING *`,
    values
  );
  return (rows[0] as ElementCategory) ?? null;
}

/**
 * Delete a category atomically. Returns not_found/has_children/deleted.
 * Single query via conditional DELETE — no TOCTOU race.
 */
export async function deleteCategory(id: string, orgId: string) {
  const pool = getPool();

  const { rowCount } = await pool.query(
    `DELETE FROM element_category
     WHERE id = $1 AND org_id = $2
       AND NOT EXISTS (SELECT 1 FROM element_category WHERE parent_id = $1)`,
    [id, orgId]
  );

  if ((rowCount ?? 0) > 0) return { deleted: true as const };

  // Distinguish not-found from has-children
  const { rows } = await pool.query(
    `SELECT EXISTS (SELECT 1 FROM element_category WHERE parent_id = $1) AS has_children`,
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

/** Reorder categories within a parent (or root level when parentId is null). */
export async function reorderCategories(
  orgId: string,
  parentId: string | null,
  orderedIds: string[]
) {
  const pool = getPool();
  await pool.query(
    `UPDATE element_category
     SET sort_order = data.pos, updated_at = now()
     FROM (SELECT unnest($1::uuid[]) AS id, generate_series(0, $2::int) AS pos) data
     WHERE element_category.id = data.id
       AND element_category.org_id = $3
       AND element_category.parent_id IS NOT DISTINCT FROM $4`,
    [orderedIds, orderedIds.length - 1, orgId, parentId]
  );
}
