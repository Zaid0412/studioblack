import type { Pool, PoolClient } from "pg";
import { getPool } from "@/lib/db";
import { CATEGORY_CODE_CONFIG_DEFAULTS } from "@/lib/categoryCode";
import type { CategoryCodeConfig } from "@/types";

type Querier = Pick<Pool | PoolClient, "query">;

/** Columns an update is allowed to set (route sends snake_case keys). */
const CONFIG_COLS = new Set([
  "auto_generate",
  "code_max_length",
  "force_uppercase",
  "prevent_duplicates",
  "lock_after_use",
]);

/**
 * The org's coding config, or the defaults when no row exists. Accepts an
 * optional executor so a caller already inside a transaction (createCategory's
 * generate path) can read it on the same connection.
 */
export async function getCategoryCodeConfig(
  orgId: string,
  executor: Querier = getPool()
): Promise<CategoryCodeConfig> {
  const { rows } = await executor.query<CategoryCodeConfig>(
    `SELECT auto_generate, code_max_length, force_uppercase, prevent_duplicates, lock_after_use
       FROM category_code_config WHERE org_id = $1`,
    [orgId]
  );
  return rows[0] ?? CATEGORY_CODE_CONFIG_DEFAULTS;
}

/** Upsert the org's coding config. Returns the full config after the write. */
export async function upsertCategoryCodeConfig(
  orgId: string,
  fields: Record<string, unknown>
): Promise<CategoryCodeConfig> {
  const cols: string[] = [];
  const vals: unknown[] = [orgId];
  for (const [col, value] of Object.entries(fields)) {
    if (value !== undefined && CONFIG_COLS.has(col)) {
      vals.push(value);
      cols.push(col);
    }
  }
  if (cols.length === 0) return getCategoryCodeConfig(orgId);

  const insertCols = cols.map((c) => `${c}`).join(", ");
  const insertVals = cols.map((_, i) => `$${i + 2}`).join(", ");
  const updateSet = cols.map((c) => `${c} = EXCLUDED.${c}`).join(", ");
  const pool = getPool();
  const { rows } = await pool.query<CategoryCodeConfig>(
    `INSERT INTO category_code_config (org_id, ${insertCols})
     VALUES ($1, ${insertVals})
     ON CONFLICT (org_id) DO UPDATE SET ${updateSet}, updated_at = now()
     RETURNING auto_generate, code_max_length, force_uppercase, prevent_duplicates, lock_after_use`,
    vals
  );
  return rows[0];
}
