import type { Pool, PoolClient } from "pg";
import { getPool } from "@/lib/db";
import { SERVICE_AREA_LEVEL, UNCATEGORIZED_PREFIX } from "@/lib/categoryCode";
import { escapeSqlLike } from "./helpers";

/**
 * Per-org auto-numbering, backed by the `sequence_counter` table.
 * Used for BOQ / RFQ / PO / rate-contract numbers and element codes.
 */

type Executor = Pool | PoolClient;

/**
 * `year = 0` marks a counter that never resets. Element codes are stable
 * library identifiers, so they keep counting across year boundaries; the
 * document sequences (BOQ, RFQ, …) pass the real year and restart each January.
 */
const NO_YEAR = 0;

/**
 * Atomically advance the `(orgId, prefix, year)` counter by `count` and return
 * the new end value. The range claimed is `end - count + 1 … end`.
 *
 * `executor` should be a transaction client whenever the caller owns one, so a
 * ROLLBACK reverses the advance instead of burning numbers and leaving gaps.
 */
async function bumpSequenceCounter(
  executor: Executor,
  orgId: string,
  prefix: string,
  year: number,
  count: number
): Promise<number> {
  const { rows } = await executor.query<{ current_value: number }>(
    `INSERT INTO sequence_counter (org_id, prefix, year, current_value)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (org_id, prefix, year)
     DO UPDATE SET current_value = sequence_counter.current_value + $4::int
     RETURNING current_value`,
    [orgId, prefix, year, count]
  );
  return rows[0].current_value;
}

/**
 * Advance the counter by one and return a formatted sequence string like
 * `BOQ-2026-001`.
 *
 * Pass `executor` (a transaction client) to advance the counter inside a
 * caller-owned transaction. Defaults to the pool for standalone use.
 */
export async function getNextSequenceNumber(
  orgId: string,
  prefix: string,
  executor: Executor = getPool()
): Promise<string> {
  const year = new Date().getUTCFullYear();
  const n = await bumpSequenceCounter(executor, orgId, prefix, year, 1);
  return `${prefix}-${year}-${String(n).padStart(3, "0")}`;
}

/**
 * Bulk-advance the sequence counter and return N formatted codes in order.
 *
 * Runs against a transaction `client` (not the pool) so a ROLLBACK in the
 * surrounding import reverses the sequence advance. Otherwise a partially-
 * applied import would burn codes permanently and leave gaps that show up on
 * client-facing invoices.
 */
export async function nextSequenceNumbers(
  client: PoolClient,
  orgId: string,
  prefix: string,
  count: number
): Promise<string[]> {
  if (count <= 0) return [];
  const year = new Date().getUTCFullYear();
  const end = await bumpSequenceCounter(client, orgId, prefix, year, count);
  const start = end - count + 1;
  return Array.from(
    { length: count },
    (_, i) => `${prefix}-${year}-${String(start + i).padStart(3, "0")}`
  );
}

/**
 * The prefix an element's code is built from: the full path code of its
 * category (`KIT`, `KIT-CAB`, `KIT-CAB-BASE` — see `categoryTemplates.ts`).
 * Falls back to `GEN` when the element is uncategorized or its category
 * carries no code.
 */
export async function elementCodePrefix(
  executor: Executor,
  orgId: string,
  categoryId: string | null | undefined
): Promise<string> {
  if (!categoryId) return UNCATEGORIZED_PREFIX;
  const { rows } = await executor.query<{ code_prefix: string | null }>(
    `SELECT code_prefix FROM element_category WHERE id = $1 AND org_id = $2`,
    [categoryId, orgId]
  );
  const prefix = rows[0]?.code_prefix?.trim();
  return prefix ? prefix : UNCATEGORIZED_PREFIX;
}

export type ServiceAreaFailure =
  | "category_not_found"
  | "category_not_service_area";

const SERVICE_AREA_ERRORS: Record<ServiceAreaFailure, string> = {
  category_not_found: "Category not found",
  category_not_service_area: "Category must be a Service Area",
};

/**
 * The one place the "must be a Service Area" rule is checked. Every write path
 * that accepts a user-picked category goes through this — the pickers are a
 * convenience, this is the enforcement.
 *
 * Scoped to the org, so it also refuses another org's category id. Without that
 * check a row could point at a foreign category and leak its names back through
 * any read that joins `element_category` (`getElementById`'s `category_path`,
 * the BOQ item library join).
 *
 * Non-throwing, because the batch callers sit inside a transaction they have to
 * roll back with a typed reason. `requireServiceArea`/`requireServiceAreas` are
 * the throwing wrappers.
 */
export async function checkServiceAreas(
  executor: Executor,
  orgId: string,
  categoryIds: readonly string[]
): Promise<
  | { ok: true; prefixes: Map<string, string> }
  | { ok: false; reason: ServiceAreaFailure; invalidIds: string[] }
> {
  const ids = [...new Set(categoryIds)];
  if (ids.length === 0) return { ok: true, prefixes: new Map() };

  const { rows } = await executor.query<{
    id: string;
    level: number;
    code_prefix: string | null;
  }>(
    `SELECT id, level, code_prefix FROM element_category
      WHERE org_id = $1 AND id = ANY($2::uuid[])`,
    [orgId, ids]
  );

  // A missing row is either a bad id or another org's — same answer either way,
  // and deliberately not distinguishable from the outside.
  const found = new Set(rows.map((r) => r.id));
  const missing = ids.filter((id) => !found.has(id));
  if (missing.length > 0) {
    return { ok: false, reason: "category_not_found", invalidIds: missing };
  }

  const wrongLevel = rows.filter((r) => r.level !== SERVICE_AREA_LEVEL);
  if (wrongLevel.length > 0) {
    return {
      ok: false,
      reason: "category_not_service_area",
      invalidIds: wrongLevel.map((r) => r.id),
    };
  }

  return {
    ok: true,
    prefixes: new Map(
      rows.map((r) => [r.id, r.code_prefix?.trim() || UNCATEGORIZED_PREFIX])
    ),
  };
}

/**
 * The throwing form, for the surfaces that write many rows at once — vendor
 * trades, rate-contract items, the BOQ import. One query for the whole batch
 * rather than one per row.
 */
export async function requireServiceAreas(
  executor: Executor,
  orgId: string,
  categoryIds: readonly string[]
): Promise<Map<string, string>> {
  const result = await checkServiceAreas(executor, orgId, categoryIds);
  if (!result.ok) throw new Error(SERVICE_AREA_ERRORS[result.reason]);
  return result.prefixes;
}

/** Single-category form. Returns the Service Area's code prefix. */
export async function requireServiceArea(
  executor: Executor,
  orgId: string,
  categoryId: string
): Promise<string> {
  const prefixes = await requireServiceAreas(executor, orgId, [categoryId]);
  return prefixes.get(categoryId) ?? UNCATEGORIZED_PREFIX;
}

/**
 * Fast-forward the counter past every code already issued under `prefix`.
 *
 * The Excel import inserts the codes it is given verbatim and never advances
 * the counter, so a library seeded from another org's export can hold
 * `KIT-0001…KIT-0005` while `(org, 'KIT')` still sits at 0. Without this, the
 * next generated code would collide, and the failed transaction would roll the
 * counter back — so every subsequent create in that category would fail the
 * same way, forever. Re-deriving the true high-water mark from the rows makes
 * that self-healing.
 *
 * Only codes shaped `<prefix>-<digits>` count; a hand-written `KIT-SPECIAL` is
 * not a sequence number and must not drag the counter anywhere.
 */
export async function syncElementCounter(
  executor: Executor,
  orgId: string,
  prefix: string
): Promise<void> {
  const { rows } = await executor.query<{ max_seq: string | null }>(
    `SELECT MAX(suffix::bigint) AS max_seq
       FROM (
         SELECT substring(code from char_length($2) + 2) AS suffix
           FROM element
          WHERE org_id = $1
            AND code LIKE $3 || '-%'
       ) s
      WHERE suffix ~ '^[0-9]+$'`,
    [orgId, prefix, escapeSqlLike(prefix)]
  );
  const maxSeq = Number(rows[0]?.max_seq ?? 0);
  if (!maxSeq) return;

  await executor.query(
    `INSERT INTO sequence_counter (org_id, prefix, year, current_value)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (org_id, prefix, year)
     DO UPDATE SET current_value = GREATEST(
       sequence_counter.current_value,
       EXCLUDED.current_value
     )`,
    [orgId, prefix, NO_YEAR, maxSeq]
  );
}

/**
 * Claim N sequential element codes for a prefix — `KIT-CAB-BASE-0001`, … The
 * counter never resets, so a code is only ever issued once per org.
 */
export async function nextElementCodes(
  executor: Executor,
  orgId: string,
  prefix: string,
  count: number
): Promise<string[]> {
  if (count <= 0) return [];
  const end = await bumpSequenceCounter(
    executor,
    orgId,
    prefix,
    NO_YEAR,
    count
  );
  const start = end - count + 1;
  return Array.from(
    { length: count },
    (_, i) => `${prefix}-${String(start + i).padStart(4, "0")}`
  );
}
