import type { Pool, PoolClient } from "pg";
import { getPool } from "@/lib/db";
import { ancestryOf, categoryKey } from "@/lib/excel/categoryPaths";
import type { ParsedCategoryNode } from "@/lib/excel/categoryParser";
import type { ElementCategory } from "@/types";

/**
 * Importing a taxonomy is a diff, not a wipe.
 *
 * A wipe is impossible: six tables carry `category_id`, under three different
 * delete rules. `rate_contract`/`rate_contract_item` are ON DELETE RESTRICT, so
 * a DELETE would simply throw and abort the whole import. `vendor_trade`
 * CASCADEs, so it would silently destroy a vendor's coverage. `element`,
 * `boq_item` and `rfq_item` SET NULL, which leaves elements uncategorised — a
 * state the rest of the app treats as illegal — while their codes
 * (`KIT-CAB-BASE-0001`) still spell out a category that no longer exists.
 *
 * So: match what's already there, update it in place, insert what's new, and
 * delete only what nothing points at. If the sheet would remove a category that
 * still has data hanging off it, the import is refused whole and the caller is
 * told exactly what is in the way.
 */

/** Anything that can run a query — the pool, or a client inside a transaction. */
type Querier = Pick<Pool | PoolClient, "query">;

/** One chain from the sheet, top-level first. */
export type CategoryPath = ParsedCategoryNode[];

export interface CategoryImportCreate {
  path: string[];
  codePrefix: string | null;
  level: number;
}

export interface CategoryImportUpdate {
  id: string;
  path: string[];
  codePrefix: string | null;
  previousCodePrefix: string | null;
}

export interface CategoryImportDelete {
  id: string;
  path: string[];
  /**
   * The node's full chain, each rung with its stored code — everything needed
   * to put it back. "Keep this" in the UI means re-adding this chain to what
   * gets sent, so a removal the user changes their mind about (or one that's
   * blocked) survives without them re-editing the sheet.
   */
  chain: { name: string; codePrefix: string | null }[];
  /** What still points at this category. */
  references: CategoryReferences;
}

export interface CategoryReferences {
  elements: number;
  vendorTrades: number;
  boqItems: number;
  rfqItems: number;
  rateContracts: number;
  rateContractItems: number;
}

export interface CategoryImportPlan {
  creates: CategoryImportCreate[];
  updates: CategoryImportUpdate[];
  deletes: CategoryImportDelete[];
  /** Deletes that cannot proceed because something still references them. */
  blocked: CategoryImportDelete[];
}

const EMPTY_REFERENCES: CategoryReferences = {
  elements: 0,
  vendorTrades: 0,
  boqItems: 0,
  rfqItems: 0,
  rateContracts: 0,
  rateContractItems: 0,
};

/** How many rows, across every table, still point at this category. */
const totalReferences = (r: CategoryReferences): number =>
  r.elements +
  r.vendorTrades +
  r.boqItems +
  r.rfqItems +
  r.rateContracts +
  r.rateContractItems;

/**
 * Count every reference to each of the given categories, in one round trip.
 * Every one of these columns is indexed, so this is six bitmap index scans.
 *
 * The caller passes the whole doomed subtree, not just its roots, because
 * `element_category.parent_id` is ON DELETE CASCADE: removing a Category
 * silently takes its Sub-categories and Service Areas with it, and it is the
 * leaves that the elements actually hang off.
 */
/**
 * Every table that references a category via `category_id`, paired with the
 * label `referencesFor` reports it under. THE single source of the reference set
 * — `isCategoryReferenced`, `getCategoryTree`'s `in_use`, and `referencesFor` all
 * build their SQL from this, so a new referencing table is added in one place.
 */
export const CATEGORY_REF_SOURCES = [
  ["element", "elements"],
  ["vendor_trade", "vendorTrades"],
  ["boq_item", "boqItems"],
  ["rfq_item", "rfqItems"],
  ["rate_contract", "rateContracts"],
  ["rate_contract_item", "rateContractItems"],
] as const;

/**
 * `UNION ALL` of `SELECT 1 FROM <t> WHERE category_id = <idExpr>` for an EXISTS
 * "is this category referenced?" check. `idExpr` is a caller-controlled SQL
 * literal (`$1`, `c.id`), never user input.
 */
export function categoryRefExistsSql(idExpr: string): string {
  return CATEGORY_REF_SOURCES.map(
    ([t]) => `SELECT 1 FROM ${t} WHERE category_id = ${idExpr}`
  ).join(" UNION ALL ");
}

/**
 * Whether a single category is referenced by any live data. A short-circuiting
 * `EXISTS` over the reference tables — cheaper than counting. Used to lock a
 * category's code once it's in use.
 */
export async function isCategoryReferenced(
  db: Querier,
  id: string
): Promise<boolean> {
  return areCategoriesReferenced(db, [id]);
}

/**
 * Whether any category in `ids` is referenced by live data — the set form of
 * `isCategoryReferenced`. Used to guard a cascade delete: the whole subtree
 * must be clear of references before it can be removed.
 */
export async function areCategoriesReferenced(
  db: Querier,
  ids: string[]
): Promise<boolean> {
  if (ids.length === 0) return false;
  const { rows } = await db.query<{ referenced: boolean }>(
    `SELECT EXISTS (${categoryRefExistsSql("ANY($1::uuid[])")} LIMIT 1) AS referenced`,
    [ids]
  );
  return rows[0]?.referenced ?? false;
}

async function referencesFor(
  db: Querier,
  ids: string[]
): Promise<Map<string, CategoryReferences>> {
  const byId = new Map<string, CategoryReferences>();
  for (const id of ids) byId.set(id, { ...EMPTY_REFERENCES });
  if (ids.length === 0) return byId;

  const { rows } = await db.query<{
    category_id: string;
    source: keyof CategoryReferences;
    cnt: string;
  }>(
    `SELECT category_id, source, COUNT(*)::text AS cnt FROM (
       ${CATEGORY_REF_SOURCES.map(
         ([t, src]) =>
           `SELECT category_id, '${src}' AS source FROM ${t} WHERE category_id = ANY($1::uuid[])`
       ).join(" UNION ALL ")}
     ) refs
     GROUP BY category_id, source`,
    [ids]
  );

  for (const row of rows) {
    const refs = byId.get(row.category_id);
    if (refs) refs[row.source] = Number(row.cnt);
  }
  return byId;
}

/** The live tree, keyed by name path — the identity both sides are matched on. */
async function liveByKey(db: Querier, orgId: string) {
  const { rows } = await db.query<
    Pick<ElementCategory, "id" | "name" | "parent_id" | "level" | "code_prefix">
  >(
    `SELECT id, name, parent_id, level, code_prefix
       FROM element_category WHERE org_id = $1
      ORDER BY level, sort_order, name`,
    [orgId]
  );

  const byId = new Map(rows.map((c) => [c.id, c]));
  const byKey = new Map<string, (typeof rows)[number] & { path: string[] }>();
  for (const category of rows) {
    const path = ancestryOf(category, byId);
    const key = categoryKey(path);
    // Identity is the name path, so two same-named siblings are indistinguishable
    // here — one would shadow the other, and a dropped-in-the-sheet shadow would
    // be deleted without a reference check. There's no DB unique constraint to
    // lean on, so refuse loudly rather than corrupt silently. (Not reachable for
    // a seeded org; possible if a duplicate was hand-created.)
    if (byKey.has(key)) {
      throw new DuplicateCategoryError(path.join(" › "));
    }
    byKey.set(key, { ...category, path });
  }
  return byKey;
}

/** The org has two categories sharing a name path — import can't tell them apart. */
export class DuplicateCategoryError extends Error {
  constructor(readonly path: string) {
    super(`Duplicate category: ${path}`);
    this.name = "DuplicateCategoryError";
  }
}

/**
 * Diff the sheet against the live tree.
 *
 * Identity is the **name path**, case-insensitively — the same key
 * `bulkCreateCategoriesFromTemplates` already dedupes on. A consequence worth
 * saying out loud: renaming a node in the sheet reads as a delete plus a create,
 * so it is refused when the old node has data attached. Changing only a code is
 * an update.
 *
 * Pass the transaction's client as `db` to plan and apply on one connection —
 * otherwise the plan describes a tree that may have moved by the time it lands.
 */
export async function planCategoryImport(
  orgId: string,
  paths: CategoryPath[],
  db: Querier = getPool()
): Promise<CategoryImportPlan> {
  const existingByKey = await liveByKey(db, orgId);

  // Every node the sheet declares, flattened — a path implies its ancestors.
  const wanted = new Map<
    string,
    { path: string[]; codePrefix: string | null }
  >();
  for (const chain of paths) {
    const names: string[] = [];
    for (const node of chain) {
      names.push(node.name);
      wanted.set(categoryKey(names), {
        path: [...names],
        codePrefix: node.codePrefix,
      });
    }
  }

  const creates: CategoryImportCreate[] = [];
  const updates: CategoryImportUpdate[] = [];

  for (const [key, node] of wanted) {
    const match = existingByKey.get(key);
    if (!match) {
      creates.push({
        path: node.path,
        codePrefix: node.codePrefix,
        level: node.path.length,
      });
      continue;
    }
    if ((match.code_prefix ?? null) !== node.codePrefix) {
      updates.push({
        id: match.id,
        path: match.path,
        codePrefix: node.codePrefix,
        previousCodePrefix: match.code_prefix ?? null,
      });
    }
  }

  const doomed = [...existingByKey.values()].filter(
    (c) => !wanted.has(categoryKey(c.path))
  );
  const references = await referencesFor(
    db,
    doomed.map((c) => c.id)
  );

  // Each ancestor prefix's stored code, so a kept removal can be put back whole.
  const codeAlong = (path: string[]) =>
    path.map((_, i) => ({
      name: path[i],
      codePrefix:
        existingByKey.get(categoryKey(path.slice(0, i + 1)))?.code_prefix ??
        null,
    }));

  const deletes: CategoryImportDelete[] = doomed.map((category) => ({
    id: category.id,
    path: category.path,
    chain: codeAlong(category.path),
    references: references.get(category.id) ?? { ...EMPTY_REFERENCES },
  }));

  return {
    creates,
    updates,
    deletes,
    blocked: deletes.filter((d) => totalReferences(d.references) > 0),
  };
}

export interface CategoryImportResult {
  created: number;
  updated: number;
  deleted: number;
}

/** The sheet drops a category something still points at. The route maps this to a 409. */
export class CategoryImportBlockedError extends Error {
  constructor(readonly blocked: CategoryImportDelete[]) {
    super("Categories still in use");
    this.name = "CategoryImportBlockedError";
  }
}

/**
 * Apply an import in one transaction.
 *
 * The plan is re-derived on the transaction's own connection and the doomed rows
 * are locked `FOR UPDATE` before anything is written — so a category that gained
 * an element between the preview and the commit still blocks, rather than being
 * deleted out from under it.
 *
 * Inserts are batched one statement per level, the way
 * `bulkCreateCategoriesFromTemplates` does it: a first import creates the whole
 * taxonomy, and a round-trip per node would hold a write transaction open for
 * hundreds of them.
 */
export async function applyCategoryImport(
  orgId: string,
  paths: CategoryPath[]
): Promise<CategoryImportResult> {
  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const plan = await planCategoryImport(orgId, paths, client);

    let deleted = 0;
    if (plan.deletes.length > 0) {
      const doomedIds = plan.deletes.map((d) => d.id);
      // Lock first, then re-count: without the lock a concurrent insert could
      // land between the count and the delete.
      await client.query(
        `SELECT 1 FROM element_category WHERE id = ANY($1::uuid[]) FOR UPDATE`,
        [doomedIds]
      );
      const references = await referencesFor(client, doomedIds);
      const blocked = plan.deletes
        .map((d) => ({
          ...d,
          references: references.get(d.id) ?? { ...EMPTY_REFERENCES },
        }))
        .filter((d) => totalReferences(d.references) > 0);
      if (blocked.length > 0) throw new CategoryImportBlockedError(blocked);

      const { rowCount } = await client.query(
        `DELETE FROM element_category WHERE id = ANY($1::uuid[]) AND org_id = $2`,
        [doomedIds, orgId]
      );
      deleted = rowCount ?? 0;
    }

    for (const update of plan.updates) {
      await client.query(
        `UPDATE element_category SET code_prefix = $1, updated_at = now()
          WHERE id = $2 AND org_id = $3`,
        [update.codePrefix, update.id, orgId]
      );
    }

    const created = await insertByLevel(client, orgId, plan);

    await client.query("COMMIT");
    return { created, updated: plan.updates.length, deleted };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Insert the new nodes, one multi-row statement per level, so a fresh taxonomy
 * costs three round-trips rather than one per node. Each level resolves its
 * parent id from the level above, which has just been inserted.
 */
async function insertByLevel(
  client: PoolClient,
  orgId: string,
  plan: CategoryImportPlan
): Promise<number> {
  if (plan.creates.length === 0) return 0;

  // Survivors, plus whatever we insert as we descend — a create's parent is
  // either a node that was already there or one made a level ago.
  const idByKey = new Map<string, string>();
  const { rows: survivors } = await client.query<{
    id: string;
    name: string;
    parent_id: string | null;
  }>(`SELECT id, name, parent_id FROM element_category WHERE org_id = $1`, [
    orgId,
  ]);
  const byId = new Map(survivors.map((r) => [r.id, r]));
  for (const row of survivors) {
    idByKey.set(categoryKey(ancestryOf(row, byId)), row.id);
  }

  // Next free sort_order per parent, kept in memory rather than re-queried per
  // insert with a correlated MAX().
  const nextSort = new Map<string, number>();
  for (const row of survivors) {
    const k = row.parent_id ?? "ROOT";
    nextSort.set(k, (nextSort.get(k) ?? 0) + 1);
  }

  let created = 0;
  for (let level = 1; level <= 3; level++) {
    const pending = plan.creates.filter((c) => c.level === level);
    if (pending.length === 0) continue;

    const values: unknown[] = [];
    const tuples: string[] = [];
    const keys: string[] = [];

    for (const node of pending) {
      const key = categoryKey(node.path);
      if (idByKey.has(key)) continue;
      const parentId =
        level === 1
          ? null
          : (idByKey.get(categoryKey(node.path.slice(0, -1))) ?? null);
      // Parent didn't survive and wasn't created — the row can't be placed.
      if (level > 1 && !parentId) continue;

      const sortKey = parentId ?? "ROOT";
      const sortOrder = nextSort.get(sortKey) ?? 0;
      nextSort.set(sortKey, sortOrder + 1);

      const i = values.length;
      tuples.push(
        `($${i + 1}, $${i + 2}, $${i + 3}, $${i + 4}, $${i + 5}, $${i + 6})`
      );
      values.push(
        orgId,
        node.path[node.path.length - 1],
        parentId,
        level,
        node.codePrefix,
        sortOrder
      );
      keys.push(key);
    }

    if (tuples.length === 0) continue;

    // Postgres returns a multi-row INSERT's rows in VALUES order, so RETURNING
    // lines up 1:1 with `keys` — that's what lets the next level find its parent.
    const { rows } = await client.query<{ id: string }>(
      `INSERT INTO element_category (org_id, name, parent_id, level, code_prefix, sort_order)
       VALUES ${tuples.join(", ")}
       RETURNING id`,
      values
    );
    rows.forEach((row, i) => idByKey.set(keys[i], row.id));
    created += rows.length;
  }

  return created;
}
