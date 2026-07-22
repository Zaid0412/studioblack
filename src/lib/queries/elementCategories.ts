import type { PoolClient } from "pg";
import { getPool } from "@/lib/db";
import {
  CATEGORY_CODE_MAX,
  CATEGORY_CODE_SEGMENT_MIN,
  applyCase,
  codeSegmentOf,
  composeCategoryCode,
  dedupeSegment,
  isSegmentTooShort,
  segmentCap,
  suggestCodeSegment,
} from "@/lib/categoryCode";
import type { BulkCategoryNode } from "@/lib/validations";
import type {
  CategoryCodeConfig,
  ElementCategory,
  ElementCategoryNode,
} from "@/types";
import { getCategoryCodeConfig } from "./categoryCodeConfig";
import {
  areCategoriesReferenced,
  categoryRefExistsSql,
  isCategoryReferenced,
} from "./categoryImport";
import { escapeSqlLike } from "./helpers";

/**
 * Resolve the `code_prefix` a category should be saved with, given the org's
 * coding config. A supplied code is enforced (length/case, and rejected on a
 * sibling collision when `prevent_duplicates` is on); an absent code is
 * auto-generated from the name when `auto_generate` is on, deduped against the
 * siblings, else left null (manual-entry mode). Always composed under the
 * parent, so `assertCodeUnderParent`'s invariant holds by construction.
 */
export class DuplicateCodeError extends Error {
  constructor(code: string) {
    super(`The code "${code}" is already used by a sibling category`);
    this.name = "DuplicateCodeError";
  }
}

/** Thrown when a category's code change is blocked because it's already in use. */
export class CategoryCodeLockedError extends Error {
  constructor() {
    super("This category's code is locked because it's already in use.");
    this.name = "CategoryCodeLockedError";
  }
}

function resolveCategoryCode(
  suppliedPrefix: string | undefined,
  name: string,
  parentPrefix: string | null,
  siblingPrefixes: (string | null)[],
  config: CategoryCodeConfig
): string | null {
  const cap = segmentCap(parentPrefix, config.code_max_length);
  const takenSegments = siblingPrefixes
    .map((p) => codeSegmentOf(p, parentPrefix))
    .filter(Boolean);

  const supplied = suppliedPrefix?.trim();
  if (supplied) {
    const seg = applyCase(
      codeSegmentOf(supplied, parentPrefix),
      config.force_uppercase
    ).slice(0, cap);
    if (!seg) return null;
    if (
      config.prevent_duplicates &&
      takenSegments.some((s) => s.toUpperCase() === seg.toUpperCase())
    ) {
      throw new DuplicateCodeError(composeCategoryCode(parentPrefix, seg));
    }
    return composeCategoryCode(parentPrefix, seg);
  }

  if (!config.auto_generate) return null;
  const suggested = applyCase(
    suggestCodeSegment(name, cap),
    config.force_uppercase
  );
  if (!suggested) return null;
  const seg = dedupeSegment(suggested, takenSegments, cap);
  return composeCategoryCode(parentPrefix, seg);
}

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
 * Fetch all categories for an org with a per-node element count and an `in_use`
 * flag, ordered for tree assembly. `element_count` covers the node's direct
 * elements (archived included) — aggregate for subtree counts client-side.
 * `in_use` is true when the category is referenced by any live data (elements,
 * vendor trades, BOQ/RFQ items, rate contracts) — drives the "code locked once
 * used" UI. The lateral EXISTS short-circuits per row over indexed columns.
 */
export async function getCategoryTree(orgId: string) {
  const pool = getPool();
  const { rows } = await pool.query(
    `SELECT c.*, COALESCE(e.cnt, 0)::int AS element_count,
       EXISTS (${categoryRefExistsSql("c.id")} LIMIT 1) AS in_use
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
  return rows as (ElementCategory & {
    element_count: number;
    in_use: boolean;
  })[];
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
 * A category's code must sit under its parent's — `KIT-CAB` under `KIT`. Element
 * codes are built by appending a sequence to this, so a code that broke the
 * chain would make `KIT-CAB-BASE-0001` a lie about where the element lives.
 * Throws when the invariant is violated.
 */
async function assertCodeUnderParent(
  executor: Pick<PoolClient, "query">,
  orgId: string,
  parentId: string | null,
  codePrefix: string | null | undefined
): Promise<void> {
  if (!parentId || !codePrefix) return;
  const { rows } = await executor.query<{ code_prefix: string | null }>(
    `SELECT code_prefix FROM element_category WHERE id = $1 AND org_id = $2`,
    [parentId, orgId]
  );
  const parentPrefix = rows[0]?.code_prefix?.trim();
  if (parentPrefix && !codePrefix.startsWith(`${parentPrefix}-`)) {
    throw new Error(
      `Code must start with the parent's code (${parentPrefix}-)`
    );
  }
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
  const config = await getCategoryCodeConfig(orgId);

  // Resolve the code inside a transaction holding a per-(org, parent) advisory
  // lock, with the sibling set read FOR UPDATE — so two concurrent creates under
  // the same parent can't generate or accept the same code (there's no DB unique
  // constraint on code_prefix).
  const client = await pool.connect();
  let rows: ElementCategory[];
  try {
    await client.query("BEGIN");
    await client.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [
      `cat-code:${orgId}:${parentId ?? "root"}`,
    ]);

    let parentPrefix: string | null = null;
    if (parentId) {
      const { rows: p } = await client.query<{ code_prefix: string | null }>(
        `SELECT code_prefix FROM element_category WHERE id = $1 AND org_id = $2`,
        [parentId, orgId]
      );
      parentPrefix = p[0]?.code_prefix?.trim() ?? null;
    }
    const { rows: sibs } = await client.query<{ code_prefix: string | null }>(
      `SELECT code_prefix FROM element_category
        WHERE org_id = $1 AND parent_id IS NOT DISTINCT FROM $2
        FOR UPDATE`,
      [orgId, parentId]
    );
    const codePrefix = resolveCategoryCode(
      input.codePrefix,
      input.name,
      parentPrefix,
      sibs.map((s) => s.code_prefix),
      config
    );

    // Backstop for a user-supplied code that bypassed the form's min-length
    // guard (e.g. a direct API call). Auto-generated codes are left lenient —
    // they can be legitimately short for a tiny name and the form blocks those.
    if (
      input.codePrefix &&
      isSegmentTooShort(codeSegmentOf(codePrefix, parentPrefix))
    ) {
      throw new Error(
        `Code must be at least ${CATEGORY_CODE_SEGMENT_MIN} characters`
      );
    }

    const result = await client.query<ElementCategory>(
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
        codePrefix,
        input.sortOrder ?? null,
        input.icon ?? null,
        input.color ?? null,
      ]
    );
    rows = result.rows;

    if (rows.length === 0) {
      // WHERE filtered out — parent not found or max depth exceeded.
      await client.query("ROLLBACK");
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

    await client.query("COMMIT");
    return rows[0];
  } catch (err: unknown) {
    await client.query("ROLLBACK").catch(() => {});
    const pgErr = err as { code?: string };
    if (pgErr.code === "23514")
      throw new Error("Maximum nesting depth reached");
    if (pgErr.code === "23503") throw new Error("Parent category not found");
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Walk a client bulk-create payload and return the first node whose own code
 * segment is a non-empty value shorter than the minimum, or null when all are
 * fine. The bulk ROUTE calls this to backstop the form's min-length guard;
 * org-provisioning seeding bypasses the route, so its curated (occasionally
 * 2-char) template codes are unaffected.
 */
export function findShortCodeSegment(
  nodes: readonly BulkCategoryNode[],
  parentPrefix: string | null = null
): string | null {
  for (const node of nodes) {
    const prefix = node.codePrefix ?? null;
    if (isSegmentTooShort(codeSegmentOf(prefix, parentPrefix))) {
      return prefix ?? "";
    }
    if (node.children?.length) {
      const found = findShortCodeSegment(node.children, prefix ?? parentPrefix);
      if (found !== null) return found;
    }
  }
  return null;
}

/** One node of the flattened template tree, linked to its parent for id resolution. */
interface SeedItem {
  node: BulkCategoryNode;
  parent: SeedItem | null;
  path: string;
  /** Resolved category id — existing, freshly inserted, or a same-batch duplicate's. */
  id?: string;
  /** Set when a sibling with the same name was already queued this batch. */
  dupOf?: SeedItem;
}

/**
 * Seed a (sub)tree of categories in one transaction, up to 3 levels deep.
 * Idempotent: a node whose `name` already exists under the same parent is
 * reused (and its missing children still get added), so re-running the
 * "Restore defaults" flow never creates duplicates.
 *
 * Inserts are batched **one level at a time** — a single multi-row INSERT per
 * depth — because siblings are independent and only need parent ids resolved
 * from the level above. This turns a full taxonomy (~150 nodes) from ~150
 * sequential round-trips into 3, which matters when this runs synchronously in
 * the org-creation path. Postgres returns the rows of a multi-row INSERT in
 * VALUES order, so `RETURNING *` aligns 1:1 with the pending list.
 *
 * Returns the rows actually inserted plus the skipped paths so the UI can
 * surface "X created, Y skipped (already existed)", and `leafIds` — the
 * resolved id of the deepest node of each supplied chain, whether it was
 * created here or already existed. The Service Area builder needs that id to
 * select the category it just made; the "restore defaults" caller ignores it.
 *
 * NOTE: inserts intentionally do NOT route through `createCategory` — that
 * helper opens its own pool connection and would break the BEGIN/COMMIT held
 * here. Mirror any guard/audit hook added to `createCategory` below.
 */
export async function bulkCreateCategoriesFromTemplates(
  orgId: string,
  templates: readonly BulkCategoryNode[]
): Promise<{
  created: ElementCategory[];
  skipped: string[];
  leafIds: string[];
}> {
  const pool = getPool();
  const client = await pool.connect();
  const created: ElementCategory[] = [];
  const skipped: string[] = [];

  try {
    await client.query("BEGIN");

    // One round-trip up front: pull every existing node so the batched insert
    // can dedupe by (parent, name) without per-node SELECTs.
    const { rows: existingRows } = await client.query<{
      id: string;
      name: string;
      parent_id: string | null;
      sort_order: number;
    }>(
      `SELECT id, name, parent_id, sort_order FROM element_category WHERE org_id = $1`,
      [orgId]
    );

    const keyOf = (parentId: string | null) => parentId ?? "ROOT";
    // parentKey → (lowercased name → id)
    const idByParentName = new Map<string, Map<string, string>>();
    // parentKey → current max sort_order
    const maxSort = new Map<string, number>();
    const siblingsFor = (k: string) => {
      let m = idByParentName.get(k);
      if (!m) idByParentName.set(k, (m = new Map()));
      return m;
    };
    for (const r of existingRows) {
      const k = keyOf(r.parent_id);
      siblingsFor(k).set(r.name.toLowerCase(), r.id);
      maxSort.set(k, Math.max(maxSort.get(k) ?? -1, r.sort_order));
    }

    // Flatten the templates into levels 1..3, keeping each node's parent link
    // so a child can read its parent's resolved id after the parent's level.
    const levels: SeedItem[][] = [[], [], []];
    // The deepest node of each chain — its id is what the Service Area builder
    // selects once the chain is in place.
    const leaves: SeedItem[] = [];
    const collect = (
      node: BulkCategoryNode,
      parent: SeedItem | null,
      level: number,
      path: string
    ) => {
      if (level > 3) return;
      const item: SeedItem = { node, parent, path };
      levels[level - 1].push(item);
      if (node.children && node.children.length > 0) {
        for (const child of node.children) {
          collect(child, item, level + 1, `${path} / ${child.name}`);
        }
      } else {
        leaves.push(item);
      }
    };
    for (const top of templates) collect(top, null, 1, top.name);

    // Mirror of `assertCodeUnderParent` for this path (the NOTE above asks for
    // it). No queries needed: every parent is in the same payload, so the whole
    // tree can be checked in memory before anything is written.
    for (const level of levels) {
      for (const item of level) {
        const parentPrefix = item.parent?.node.codePrefix?.trim();
        const code = item.node.codePrefix?.trim();
        if (parentPrefix && code && !code.startsWith(`${parentPrefix}-`)) {
          throw new Error(
            `Code "${code}" must start with its parent's code (${parentPrefix}-)`
          );
        }
      }
    }

    for (let level = 1; level <= 3; level++) {
      const items = levels[level - 1];
      if (items.length === 0) continue;

      const pending: SeedItem[] = [];
      const values: unknown[] = [];
      const rowsSql: string[] = [];
      // parentKey → names already queued this batch (dedupe intra-payload).
      const queued = new Map<string, Map<string, SeedItem>>();

      for (const item of items) {
        const parentId = item.parent ? (item.parent.id ?? null) : null;
        // Parent couldn't be resolved (should not happen) — can't place child.
        if (item.parent && item.parent.id == null) continue;

        const k = keyOf(parentId);
        const nameKey = item.node.name.toLowerCase();

        const existingId = siblingsFor(k).get(nameKey);
        if (existingId) {
          item.id = existingId;
          skipped.push(item.path);
          continue;
        }

        let names = queued.get(k);
        if (!names) queued.set(k, (names = new Map()));
        const firstDup = names.get(nameKey);
        if (firstDup) {
          item.dupOf = firstDup;
          skipped.push(item.path);
          continue;
        }
        names.set(nameKey, item);

        const sort = (maxSort.get(k) ?? -1) + 1;
        maxSort.set(k, sort);
        const b = values.length;
        rowsSql.push(
          `($${b + 1}, $${b + 2}, $${b + 3}, $${b + 4}, $${b + 5}, $${b + 6}, $${b + 7}, $${b + 8})`
        );
        values.push(
          orgId,
          item.node.name,
          parentId,
          level,
          item.node.codePrefix ?? null,
          sort,
          item.node.icon ?? null,
          item.node.color ?? null
        );
        pending.push(item);
      }

      if (pending.length > 0) {
        const { rows } = await client.query<ElementCategory>(
          `INSERT INTO element_category
             (org_id, name, parent_id, level, code_prefix, sort_order, icon, color)
           VALUES ${rowsSql.join(", ")}
           RETURNING *`,
          values
        );
        rows.forEach((row, i) => {
          const item = pending[i];
          item.id = row.id;
          const pid = item.parent ? (item.parent.id ?? null) : null;
          siblingsFor(keyOf(pid)).set(item.node.name.toLowerCase(), row.id);
          created.push(row);
        });
      }

      // Resolve intra-batch duplicates to the sibling that was actually inserted.
      for (const item of items) {
        if (!item.id && item.dupOf) item.id = item.dupOf.id;
      }
    }

    await client.query("COMMIT");
    // Every leaf resolves to an id — inserted, pre-existing, or an intra-batch
    // duplicate — unless its parent couldn't be placed, which the level loop
    // skips. filter(Boolean) rather than assert, so a partial payload degrades.
    const leafIds = leaves
      .map((l) => l.id)
      .filter((id): id is string => id !== undefined);
    return { created, skipped, leafIds };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
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
 *
 * Renaming a code cascades to descendants — their codes embed this one
 * (`KIT-CAB` → `KIT-CAB-BASE`), so leaving them behind would strand the whole
 * subtree under a code that no longer exists. Element codes already issued are
 * deliberately NOT rewritten: they are stable identifiers, referenced from BOQ
 * items and used as the Excel import's join key.
 */
export async function updateCategory(
  id: string,
  orgId: string,
  fields: Record<string, unknown>
) {
  const pool = getPool();

  const { rows: before } = await pool.query<{
    code_prefix: string | null;
    parent_id: string | null;
  }>(
    `SELECT code_prefix, parent_id FROM element_category
      WHERE id = $1 AND org_id = $2`,
    [id, orgId]
  );
  if (before.length === 0) return null;
  const oldPrefix = before[0].code_prefix;

  // The edit dialog always sends codePrefix, but most edits (rename, recolor,
  // reorder) leave it untouched. Drop it from the SET list when it hasn't
  // moved: nothing to cascade, so nothing needs a transaction. Dropping the
  // column rather than writing the same value back is what keeps this
  // race-free — the rename can't stomp a concurrent prefix change.
  const nextPrefix = normalizeUpdatedPrefix(fields.code_prefix);
  const prefixChanged =
    nextPrefix !== undefined && nextPrefix !== (oldPrefix ?? null);
  if (!prefixChanged) delete fields.code_prefix;

  const build = () => {
    const updates: string[] = [];
    const values: unknown[] = [];
    for (const [col, value] of Object.entries(fields)) {
      if (value !== undefined && CATEGORY_COLS.has(col)) {
        values.push(value === "" ? null : value);
        updates.push(`"${col}" = $${values.length}`);
      }
    }
    if (updates.length === 0) return null;
    updates.push(`updated_at = now()`);
    values.push(id, orgId);
    return {
      sql: `UPDATE element_category SET ${updates.join(", ")}
             WHERE id = $${values.length - 1} AND org_id = $${values.length}
             RETURNING *`,
      values,
    };
  };

  const query = build();
  if (!query) return null;

  if (!prefixChanged) {
    const { rows } = await pool.query(query.sql, query.values);
    return (rows[0] as ElementCategory) ?? null;
  }

  // The code moved: validate it against the parent and re-base the subtree,
  // all under one transaction so a failed cascade doesn't leave a half-renamed
  // tree behind.
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `SELECT 1 FROM element_category WHERE id = $1 AND org_id = $2 FOR UPDATE`,
      [id, orgId]
    );
    // A code is editable before use, locked after — refuse the code change once
    // the category is referenced by live data (when the org opts into it).
    const config = await getCategoryCodeConfig(orgId, client);
    if (config.lock_after_use && (await isCategoryReferenced(client, id))) {
      throw new CategoryCodeLockedError();
    }
    await assertCodeUnderParent(client, orgId, before[0].parent_id, nextPrefix);

    const { rows } = await client.query(query.sql, query.values);
    const updated = (rows[0] as ElementCategory) ?? null;

    if (updated && oldPrefix && updated.code_prefix) {
      await cascadeCodePrefix(
        client,
        orgId,
        id,
        oldPrefix,
        updated.code_prefix
      );
    }

    await client.query("COMMIT");
    return updated;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

/** The route sends `""` to clear a code; the column stores that as NULL. */
function normalizeUpdatedPrefix(raw: unknown): string | null | undefined {
  if (raw === undefined) return undefined;
  if (raw === "" || raw === null) return null;
  return raw as string;
}

/**
 * Re-base every descendant's code onto the node's new code. Only rows whose
 * code actually sits under the old one are touched, so a subtree that was
 * hand-coded off-pattern (before composition was enforced) is left alone
 * rather than silently mangled.
 *
 * A longer code lengthens the whole subtree, so the deepest descendant can
 * overflow `code_prefix`. Catch that here — a bare 22001 from the UPDATE would
 * reach the user as "value too long for type character varying(20)", which says
 * nothing about which category is the problem.
 */
async function cascadeCodePrefix(
  client: PoolClient,
  orgId: string,
  id: string,
  oldPrefix: string,
  newPrefix: string
): Promise<void> {
  if (oldPrefix === newPrefix) return;

  // `LIKE` is only safe with the prefix escaped: `code_prefix` is validated as
  // a plain max(20) string, so a code holding `_` or `%` would otherwise match
  // — and rewrite — categories in unrelated subtrees.
  const under = `${escapeSqlLike(oldPrefix)}-%`;
  const grew = newPrefix.length - oldPrefix.length;

  // Strict descendants of $1 within $2 — the node itself is excluded, so a
  // rename that nests a code under itself (KIT → KIT-A) can't rewrite the root.
  const descendants = `WITH RECURSIVE descendant AS (
       SELECT id FROM element_category
        WHERE parent_id = $1 AND org_id = $2
       UNION ALL
       SELECT c.id FROM element_category c
         JOIN descendant d ON c.parent_id = d.id
        WHERE c.org_id = $2
     )`;

  if (grew > 0) {
    const { rows } = await client.query<{ code_prefix: string }>(
      `${descendants}
       SELECT c.code_prefix FROM element_category c
         JOIN descendant d ON c.id = d.id
        WHERE c.code_prefix LIKE $3
        ORDER BY char_length(c.code_prefix) DESC
        LIMIT 1`,
      [id, orgId, under]
    );
    const longest = rows[0]?.code_prefix;
    if (longest && longest.length + grew > CATEGORY_CODE_MAX) {
      throw new Error(
        `Code is too long: it would push "${longest}" past ${CATEGORY_CODE_MAX} characters`
      );
    }
  }

  await client.query(
    `${descendants}
     UPDATE element_category c
        SET code_prefix = $3 || substring(c.code_prefix from char_length($4) + 1),
            updated_at = now()
       FROM descendant d
      WHERE c.id = d.id
        AND c.code_prefix LIKE $5`,
    [id, orgId, newPrefix, oldPrefix, under]
  );
}

/**
 * Delete a category and its whole subtree. Structural children (sub-categories,
 * service areas) are removed by the `parent_id ON DELETE CASCADE` FK, so a
 * single delete of the root clears the branch — but only once nothing in the
 * subtree is still referenced by live data (elements, BOQ/RFQ items, vendor
 * trades, rate contracts). Elements must be moved out first; the cascade would
 * otherwise silently orphan them (SET NULL) or hit a RESTRICT and throw.
 *
 * The subtree is scanned **and locked** (`FOR UPDATE`) before the reference
 * check, all in one transaction. Adding a reference (element / BOQ / RFQ /
 * vendor / rate-contract) takes a `FOR KEY SHARE` lock on its parent category
 * row, which conflicts with our `FOR UPDATE` — so a concurrent reference can't
 * slip in between the check and the delete: it blocks until we commit, then
 * fails its FK because the row is gone.
 * Returns not_found/referenced/deleted.
 *
 * NOTE: the API-route tests mock this function, so the SQL below (recursive
 * CTE + reference guard + cascade) isn't exercised by the suite — verify SQL
 * edits against a real DB.
 */
export async function deleteCategory(id: string, orgId: string) {
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Gather the whole subtree and lock those category rows. FOR UPDATE lives on
    // the outer SELECT (it can't sit on a recursive term), which is enough — the
    // lock is what closes the check-then-delete race.
    const { rows: subtree } = await client.query<{ id: string }>(
      `WITH RECURSIVE subtree AS (
         SELECT id FROM element_category WHERE id = $1 AND org_id = $2
         UNION ALL
         SELECT c.id FROM element_category c
           JOIN subtree s ON c.parent_id = s.id
       )
       SELECT id FROM element_category
        WHERE id IN (SELECT id FROM subtree)
        FOR UPDATE`,
      [id, orgId]
    );

    if (subtree.length === 0) {
      await client.query("ROLLBACK");
      return { deleted: false as const, error: "Category not found" };
    }

    if (
      await areCategoriesReferenced(
        client,
        subtree.map((r) => r.id)
      )
    ) {
      await client.query("ROLLBACK");
      return {
        deleted: false as const,
        error: "Category is still in use. Move its elements first.",
      };
    }

    await client.query(
      `DELETE FROM element_category WHERE id = $1 AND org_id = $2`,
      [id, orgId]
    );
    await client.query("COMMIT");
    return { deleted: true as const };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}
