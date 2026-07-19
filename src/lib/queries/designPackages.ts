import type { PoolClient } from "pg";
import { getPool } from "@/lib/db";
import {
  DESIGN_PACKAGE_DEFAULTS,
  DISCIPLINE_DEFAULTS,
} from "@/lib/designTemplates";
import type { DesignDiscipline, DesignPackage } from "@/types";

/**
 * Design → Document Control module (PRD "01.Design doc"), PR-1.
 *
 * Design packages are the per-project milestone grouping (Concept, Schematic, …)
 * that will replace the legacy design phases; disciplines are a per-org lookup.
 * This module owns their seeding and read paths — the drawing register,
 * numbering, and lifecycle land in later PRs.
 */

/**
 * Seed an org's default disciplines. Idempotent (per-code NOT EXISTS guard), so
 * it doubles as a backfill for orgs that predate this feature — mirrors
 * `seedDefaultDivisions`. Called from `provisionNewOrg`.
 */
export async function seedDefaultDisciplines(orgId: string): Promise<number> {
  const pool = getPool();
  const codes = DISCIPLINE_DEFAULTS.map((d) => d.code);
  const names = DISCIPLINE_DEFAULTS.map((d) => d.name);
  const { rowCount } = await pool.query(
    `INSERT INTO design_discipline (org_id, code, name, sort_order)
     SELECT $1, d.code, d.name, d.ord - 1
       FROM unnest($2::text[], $3::text[]) WITH ORDINALITY AS d(code, name, ord)
      WHERE NOT EXISTS (
        SELECT 1 FROM design_discipline x
         WHERE x.org_id = $1 AND lower(x.code) = lower(d.code)
      )`,
    [orgId, codes, names]
  );
  return rowCount ?? 0;
}

/** An org's active disciplines, ordered for display. */
export async function getDesignDisciplines(
  orgId: string
): Promise<DesignDiscipline[]> {
  const pool = getPool();
  const { rows } = await pool.query(
    `SELECT * FROM design_discipline
      WHERE org_id = $1 AND is_active = true
      ORDER BY sort_order, name`,
    [orgId]
  );
  return rows as DesignDiscipline[];
}

/**
 * Seed the 6 default packages for a newly-created project. Takes the caller's
 * transaction client so it commits atomically with the project insert (mirrors
 * the phase/step seeding in `createProject`).
 */
export async function seedDesignPackages(
  client: PoolClient,
  projectId: string,
  orgId: string
): Promise<void> {
  const codes = DESIGN_PACKAGE_DEFAULTS.map((p) => p.code);
  const names = DESIGN_PACKAGE_DEFAULTS.map((p) => p.name);
  await client.query(
    `INSERT INTO design_package (project_id, org_id, code, name, sort_order)
     SELECT $1, $2, d.code, d.name, d.ord - 1
       FROM unnest($3::text[], $4::text[]) WITH ORDINALITY AS d(code, name, ord)`,
    [projectId, orgId, codes, names]
  );
}

/** A project's design packages, ordered for display. */
export async function getDesignPackages(
  projectId: string
): Promise<DesignPackage[]> {
  const pool = getPool();
  const { rows } = await pool.query(
    `SELECT * FROM design_package WHERE project_id = $1 ORDER BY sort_order`,
    [projectId]
  );
  return rows as DesignPackage[];
}
