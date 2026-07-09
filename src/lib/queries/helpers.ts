import crypto from "crypto";

/**
 * Generate a 32-char alphanumeric ID matching better-auth's format.
 * Uses the same charset (a-z, A-Z, 0-9) and length as better-auth's generateId.
 */
export function generateBetterAuthId(size = 32): string {
  const chars =
    "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  const limit = 256 - (256 % chars.length); // rejection threshold to avoid modulo bias
  let result = "";
  while (result.length < size) {
    const bytes = crypto.randomBytes(size - result.length);
    for (let i = 0; i < bytes.length && result.length < size; i++) {
      if (bytes[i] < limit) {
        result += chars[bytes[i] % chars.length];
      }
    }
  }
  return result;
}

/** Escape SQL LIKE/ILIKE wildcards so user input is treated as literal text. */
export function escapeSqlLike(str: string): string {
  return str.replace(/[\\%_]/g, (ch) => `\\${ch}`);
}

/**
 * SQL fragment that resolves a category id and all of its descendants in the
 * `element_category` tree, for use inside an `IN (...)` clause. The caller must
 * bind the root category id to `$<paramIndex>`. Shared by the element library
 * and vendor-trade category filters so the recursion lives in one place.
 */
export function descendantCategoryIdsSql(paramIndex: number): string {
  return `(
    WITH RECURSIVE cat_tree AS (
      SELECT id FROM element_category WHERE id = $${paramIndex}
      UNION ALL
      SELECT c.id FROM element_category c
      JOIN cat_tree t ON c.parent_id = t.id
    )
    SELECT id FROM cat_tree
  )`;
}

/**
 * SQL fragment resolving the service area of the element bound to
 * `$<elementParamIndex>` plus every ancestor category, for use inside an
 * `IN (...)` clause. A rate priced on any of these categories covers the
 * element. Single source of the "ancestor covers descendant" rule — shared by
 * the rate-contract matcher and both BOQ apply validators so they can't drift.
 */
export function elementAncestorCategoryIdsSql(
  elementParamIndex: number
): string {
  return `(
    WITH RECURSIVE anc AS (
      SELECT ec.id, ec.parent_id
        FROM element_category ec
        JOIN element e ON e.category_id = ec.id
       WHERE e.id = $${elementParamIndex}
      UNION ALL
      SELECT p.id, p.parent_id
        FROM element_category p
        JOIN anc ON p.id = anc.parent_id
    )
    SELECT id FROM anc
  )`;
}

/**
 * SQL fragment resolving the category bound to `$<categoryParamIndex>` plus
 * every ancestor, for use inside an `IN (...)` clause. The category-keyed twin
 * of `elementAncestorCategoryIdsSql` — lets a line that carries only a
 * `category_id` (a free-text BOQ item with no element) match rates and vendors
 * the same way an element-backed line does. Same "ancestor covers descendant"
 * rule, keyed off a category rather than an element.
 */
export function categoryAncestorCategoryIdsSql(
  categoryParamIndex: number
): string {
  return `(
    WITH RECURSIVE anc AS (
      SELECT ec.id, ec.parent_id
        FROM element_category ec
       WHERE ec.id = $${categoryParamIndex}
      UNION ALL
      SELECT p.id, p.parent_id
        FROM element_category p
        JOIN anc ON p.id = anc.parent_id
    )
    SELECT id FROM anc
  )`;
}
