/**
 * Backfill: give every orphan BOQ line (`element_id IS NULL`) a real Element,
 * so `boq_item.element_id` can be made NOT NULL (PRD 2.2, R1 full enforcement).
 *
 * Per org, orphan lines are grouped by `(category_id, lower(description))` — one
 * `custom` Element is created per group (Library-format code via the shared
 * sequence; grandfathered NULL-category lines get the UNCATEGORIZED prefix) and
 * every line in the group is linked to it. Runs one transaction per org.
 *
 * Idempotent: only orphan lines are read, and the link UPDATE re-checks
 * `element_id IS NULL`, so re-running processes only what's left.
 *
 * `item_code`: a backfilled line's code is (re)set to its new element's freshly
 * generated code. A bare #209-era code is intentionally replaced — it now names
 * a real element — at the cost of one sequence number per group. That's the
 * right normalization for a one-off; we don't try to preserve the old bare code.
 *
 * Run during a quiet window. Per-org atomicity handles crashes, but if the live
 * app links every line of a group between the fetch and the UPDATE, the element
 * is still created yet links 0 rows — leaving one stray (harmless) element.
 *
 * Usage:
 *   npx tsx scripts/backfill-boq-element-ids.ts                    # all orgs
 *   BACKFILL_ORG_ID=<orgId> npx tsx scripts/backfill-boq-element-ids.ts  # one org
 *
 * Run this BEFORE `scripts/migrate-boq-item-element-not-null.sql` on the same DB.
 */

import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

// Load env BEFORE importing anything that reads DATABASE_URL.
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

/**
 * Dedup key for grouping orphan lines: exact Service Area + normalized
 * (lower-cased, trimmed) description. The `∅` sentinel keeps a real NULL
 * category distinct from any literal string (`category_id` is a UUID, so it can
 * never collide with `∅`). Exported for testing.
 */
export function groupKey(
  categoryId: string | null,
  description: string | null
): string {
  return `${categoryId ?? "∅"}|${(description ?? "").toLowerCase().trim()}`;
}

interface OrphanLine {
  id: string;
  category_id: string | null;
  description: string;
  name: string | null;
  unit: string;
  unit_cost: string;
  material_cost: string | null;
  labour_cost: string | null;
  overhead_pct: string;
  service_charge_pct: string;
  margin_pct: string;
  client_rate: string | null;
  budget_rate: string | null;
  currency: string;
  boq_id: string;
  boq_created_by: string | null;
}

async function main() {
  const { getPool } = await import("../src/lib/db");
  const { generateElementCodeFor } =
    await import("../src/lib/queries/elements");

  const orgFilter = process.env.BACKFILL_ORG_ID?.trim() || null;
  const pool = getPool();

  const { rows: orgs } = await pool.query<{ org_id: string }>(
    `SELECT DISTINCT p.org_id
       FROM boq_item bi
       JOIN boq b ON b.id = bi.boq_id
       JOIN project p ON p.id = b.project_id
      WHERE bi.element_id IS NULL
        AND ($1::text IS NULL OR p.org_id = $1)`,
    [orgFilter]
  );

  console.log(
    `Backfill target: ${orgFilter ? `org ${orgFilter}` : "ALL orgs"} — ${orgs.length} org(s) with orphan lines.`
  );

  let elementsCreated = 0;
  let linesLinked = 0;

  for (const { org_id } of orgs) {
    const client = await pool.connect();
    let orgLinked = 0;
    try {
      await client.query("BEGIN");

      const { rows: lines } = await client.query<OrphanLine>(
        `SELECT bi.id, bi.category_id, bi.description, bi.name, bi.unit,
                bi.unit_cost, bi.material_cost, bi.labour_cost, bi.overhead_pct,
                bi.service_charge_pct, bi.margin_pct, bi.client_rate, bi.budget_rate,
                b.currency, b.id AS boq_id, b.created_by AS boq_created_by
           FROM boq_item bi
           JOIN boq b ON b.id = bi.boq_id
           JOIN project p ON p.id = b.project_id
          WHERE p.org_id = $1 AND bi.element_id IS NULL
          ORDER BY bi.created_at`,
        [org_id]
      );

      // Group by (category_id, lower(description)) — one element per group.
      const groups = new Map<string, OrphanLine[]>();
      for (const line of lines) {
        const key = groupKey(line.category_id, line.description);
        const g = groups.get(key);
        if (g) g.push(line);
        else groups.set(key, [line]);
      }

      for (const group of groups.values()) {
        const rep = group[0];
        const code = await generateElementCodeFor(
          client,
          org_id,
          rep.category_id
        );
        const elName = (rep.name?.trim() || rep.description || code).slice(
          0,
          255
        );

        const {
          rows: [el],
        } = await client.query<{ id: string; code: string }>(
          `INSERT INTO element
             (org_id, code, name, description, category_id, unit, unit_cost,
              currency, material_cost, labour_cost, overhead_pct, service_charge_pct,
              margin_pct, client_rate, budget_rate, created_by, element_type, origin_boq_id)
           VALUES ($1, $2, $3, $4, $5::uuid, $6, COALESCE($7::numeric, 0),
                   $8, $9::numeric, $10::numeric, COALESCE($11::numeric, 0),
                   COALESCE($12::numeric, 0), COALESCE($13::numeric, 0),
                   $14::numeric, $15::numeric, $16, 'custom', $17)
           RETURNING id, code`,
          [
            org_id,
            code,
            elName,
            rep.description,
            rep.category_id,
            rep.unit,
            rep.unit_cost,
            rep.currency,
            rep.material_cost,
            rep.labour_cost,
            rep.overhead_pct,
            rep.service_charge_pct,
            rep.margin_pct,
            rep.client_rate,
            rep.budget_rate,
            rep.boq_created_by,
            rep.boq_id,
          ]
        );
        elementsCreated += 1;

        const { rowCount } = await client.query(
          `UPDATE boq_item
              SET element_id = $1, item_code = $2
            WHERE id = ANY($3::uuid[]) AND element_id IS NULL`,
          [el.id, el.code, group.map((l) => l.id)]
        );
        orgLinked += rowCount ?? 0;
      }

      await client.query("COMMIT");
      linesLinked += orgLinked;
      console.log(
        `  org ${org_id}: ${groups.size} element(s), ${orgLinked} line(s) linked.`
      );
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  }

  console.log(
    `Done. Created ${elementsCreated} custom element(s), linked ${linesLinked} line(s).`
  );
  await pool.end();
}

// Only run when invoked directly (`tsx scripts/…`), not when imported by a test.
const isEntrypoint =
  !!process.argv[1] &&
  fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isEntrypoint) {
  main().catch((err) => {
    console.error("Backfill failed:", err);
    process.exit(1);
  });
}
