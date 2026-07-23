import { getPool } from "@/lib/db";
import { DIVISION_DEFAULTS } from "@/lib/divisionTemplates";
import type { Division, DivisionUsage } from "@/types";

/** Columns an update is allowed to set (route handler sends snake_case keys). */
const DIVISION_COLS = new Set([
  "code",
  "name",
  "sort_order",
  "enabled",
  "is_default",
]);

/**
 * Guard for cross-scope FK writes: divisions are org-level, sections are
 * project-level, and nothing DB-side ties a section's division to the section's
 * org. Section create/update calls this before persisting a `division_id`.
 */
export async function divisionBelongsToOrg(
  id: string,
  orgId: string
): Promise<boolean> {
  const pool = getPool();
  const { rowCount } = await pool.query(
    `SELECT 1 FROM division WHERE id = $1 AND org_id = $2`,
    [id, orgId]
  );
  return (rowCount ?? 0) > 0;
}

/** List an org's divisions, ordered for display. */
export async function getDivisions(orgId: string) {
  const pool = getPool();
  const { rows } = await pool.query(
    `SELECT * FROM division WHERE org_id = $1 ORDER BY sort_order, name`,
    [orgId]
  );
  return rows as Division[];
}

/**
 * Create a division. `sort_order` auto-appends. A duplicate code (case-insensitive,
 * per org) surfaces as a friendly message rather than a raw 23505.
 */
export async function createDivision(
  orgId: string,
  input: { code: string; name: string; sortOrder?: number }
): Promise<Division> {
  const pool = getPool();
  try {
    const { rows } = await pool.query(
      `INSERT INTO division (org_id, code, name, sort_order)
       VALUES ($1, $2, $3,
         COALESCE($4::int, (SELECT COALESCE(MAX(sort_order), -1) + 1 FROM division WHERE org_id = $1)))
       RETURNING *`,
      [orgId, input.code, input.name, input.sortOrder ?? null]
    );
    return rows[0] as Division;
  } catch (err: unknown) {
    if ((err as { code?: string }).code === "23505")
      throw new Error("A division with this code already exists");
    throw err;
  }
}

/**
 * Update a division's fields (rename / enable / disable / default / reorder a
 * single row). Returns null when the division doesn't exist or nothing to set.
 */
export async function updateDivision(
  id: string,
  orgId: string,
  fields: Record<string, unknown>
) {
  const pool = getPool();
  const updates: string[] = [];
  const values: unknown[] = [];
  for (const [col, value] of Object.entries(fields)) {
    if (value !== undefined && DIVISION_COLS.has(col)) {
      values.push(value);
      updates.push(`"${col}" = $${values.length}`);
    }
  }
  if (updates.length === 0) return null;
  updates.push(`updated_at = now()`);
  values.push(id, orgId);
  try {
    const { rows } = await pool.query(
      `UPDATE division SET ${updates.join(", ")}
        WHERE id = $${values.length - 1} AND org_id = $${values.length}
        RETURNING *`,
      values
    );
    return (rows[0] as Division) ?? null;
  } catch (err: unknown) {
    if ((err as { code?: string }).code === "23505")
      throw new Error("A division with this code already exists");
    throw err;
  }
}

/**
 * Delete a division. Blocked while any BOQ section OR line still references it
 * (a line's `division_id` is mandatory, so a referenced division can't be
 * hard-deleted) — the UI disables such a division instead. Single conditional
 * DELETE (no TOCTOU race), mirroring `deleteCategory`.
 */
export async function deleteDivision(id: string, orgId: string) {
  const pool = getPool();
  const { rowCount } = await pool.query(
    `DELETE FROM division
      WHERE id = $1 AND org_id = $2
        AND NOT EXISTS (SELECT 1 FROM boq_section WHERE division_id = $1)
        AND NOT EXISTS (SELECT 1 FROM boq_item WHERE division_id = $1)`,
    [id, orgId]
  );
  if ((rowCount ?? 0) > 0) return { deleted: true as const };

  const { rows } = await pool.query(
    `SELECT EXISTS (
       SELECT 1 FROM boq_section WHERE division_id = $1
       UNION ALL
       SELECT 1 FROM boq_item WHERE division_id = $1
     ) AS in_use`,
    [id]
  );
  if (rows[0]?.in_use)
    return {
      deleted: false as const,
      error: "Division is in use by a BOQ. Disable it instead.",
    };
  return { deleted: false as const, error: "Division not found" };
}

/**
 * Where a division is referenced, grouped by project — both BOQ line items and
 * BOQ sections (a section holds the division even with zero lines, which is the
 * invisible reference that blocks a delete). Org-scoped; ordered by project
 * name. Empty array ⇒ safe to delete.
 */
export async function getDivisionUsage(
  id: string,
  orgId: string
): Promise<DivisionUsage[]> {
  const pool = getPool();
  const { rows } = await pool.query<DivisionUsage>(
    `WITH refs AS (
       SELECT b.project_id, 'item' AS kind
         FROM boq_item bi JOIN boq b ON b.id = bi.boq_id
        WHERE bi.division_id = $1
       UNION ALL
       SELECT b.project_id, 'section' AS kind
         FROM boq_section bs JOIN boq b ON b.id = bs.boq_id
        WHERE bs.division_id = $1
     )
     SELECT p.id AS project_id, p.name AS project_name,
            COUNT(*) FILTER (WHERE r.kind = 'item')::int AS item_count,
            COUNT(*) FILTER (WHERE r.kind = 'section')::int AS section_count
       FROM refs r
       JOIN project p ON p.id = r.project_id AND p.org_id = $2
      GROUP BY p.id, p.name
      ORDER BY p.name`,
    [id, orgId]
  );
  return rows;
}

/** Reorder an org's divisions to match `orderedIds`. */
export async function reorderDivisions(orgId: string, orderedIds: string[]) {
  const pool = getPool();
  await pool.query(
    `UPDATE division
        SET sort_order = data.pos, updated_at = now()
       FROM (SELECT unnest($1::uuid[]) AS id, generate_series(0, $2::int) AS pos) data
      WHERE division.id = data.id AND division.org_id = $3`,
    [orderedIds, orderedIds.length - 1, orgId]
  );
}

/**
 * Seed the default division library for an org. Idempotent by (org_id,
 * lower(code)) so re-running (org backfill or "Restore defaults") adds only the
 * codes that are missing. Returns how many rows were inserted.
 */
export async function seedDefaultDivisions(orgId: string): Promise<number> {
  const pool = getPool();
  const codes = DIVISION_DEFAULTS.map((d) => d.code);
  const names = DIVISION_DEFAULTS.map((d) => d.name);
  const { rowCount } = await pool.query(
    `INSERT INTO division (org_id, code, name, sort_order)
     SELECT $1, d.code, d.name, d.ord - 1
       FROM unnest($2::text[], $3::text[]) WITH ORDINALITY AS d(code, name, ord)
      WHERE NOT EXISTS (
        SELECT 1 FROM division x WHERE x.org_id = $1 AND lower(x.code) = lower(d.code)
      )`,
    [orgId, codes, names]
  );
  return rowCount ?? 0;
}
