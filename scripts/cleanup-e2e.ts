/**
 * Clean up E2E test data from the database.
 *
 * Usage:
 *   npx tsx scripts/cleanup-e2e.ts
 *
 * Removes all users matching the e2e-*@test.studioblack.com pattern
 * and any associated organizations, projects, and data.
 */

import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

async function cleanup() {
  const pg = await import("pg");
  const Pool = pg.default?.Pool ?? pg.Pool;
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  console.log("Cleaning up E2E test data...\n");

  // Find E2E test users
  const { rows: users } = await pool.query(
    `SELECT id, email FROM "user" WHERE email LIKE 'e2e-%@test.studioblack.com'`
  );

  if (users.length === 0) {
    console.log("  No E2E test users found.");
    await pool.end();
    process.exit(0);
  }

  const userIds = users.map((u) => u.id);
  console.log(`  Found ${users.length} E2E test user(s)`);

  // Clean up in dependency order
  // 1. Projects created by E2E users (and their related data)
  const { rows: projects } = await pool.query(
    `SELECT id FROM project WHERE created_by = ANY($1)`,
    [userIds]
  );
  const projectIds = projects.map((p) => p.id);

  if (projectIds.length > 0) {
    // Delete project-related data
    await pool.query(`DELETE FROM comment WHERE project_id = ANY($1)`, [
      projectIds,
    ]);
    await pool.query(`DELETE FROM attachment WHERE project_id = ANY($1)`, [
      projectIds,
    ]);
    await pool.query(`DELETE FROM phase_task WHERE project_id = ANY($1)`, [
      projectIds,
    ]);
    await pool.query(`DELETE FROM phase WHERE project_id = ANY($1)`, [
      projectIds,
    ]);
    await pool.query(`DELETE FROM step WHERE project_id = ANY($1)`, [
      projectIds,
    ]);
    await pool.query(`DELETE FROM project_member WHERE project_id = ANY($1)`, [
      projectIds,
    ]);
    await pool.query(`DELETE FROM project WHERE id = ANY($1)`, [projectIds]);
    console.log(`  Deleted ${projectIds.length} project(s) and related data`);
  }

  // 2. Organization memberships and orgs
  const { rows: orgs } = await pool.query(
    `SELECT DISTINCT o.id FROM "organization" o
     JOIN "member" m ON m."organizationId" = o.id
     WHERE m."userId" = ANY($1) AND m.role = 'owner'
     AND o.name LIKE 'E2E%'`,
    [userIds]
  );
  const orgIds = orgs.map((o) => o.id);

  if (orgIds.length > 0) {
    await pool.query(
      `DELETE FROM "invitation" WHERE "organizationId" = ANY($1)`,
      [orgIds]
    );
    await pool.query(`DELETE FROM "member" WHERE "organizationId" = ANY($1)`, [
      orgIds,
    ]);
    await pool.query(`DELETE FROM "organization" WHERE id = ANY($1)`, [orgIds]);
    console.log(`  Deleted ${orgIds.length} organization(s)`);
  }

  // Also remove member entries for non-owned orgs
  await pool.query(`DELETE FROM "member" WHERE "userId" = ANY($1)`, [userIds]);

  // 3. Sessions and accounts
  await pool.query(`DELETE FROM "session" WHERE "userId" = ANY($1)`, [userIds]);
  await pool.query(`DELETE FROM "account" WHERE "userId" = ANY($1)`, [userIds]);
  await pool.query(`DELETE FROM "verification" WHERE identifier = ANY($1)`, [
    users.map((u) => u.email),
  ]);

  // 4. Users
  await pool.query(`DELETE FROM "user" WHERE id = ANY($1)`, [userIds]);
  console.log(`  Deleted users: ${users.map((u) => u.email).join(", ")}`);

  await pool.end();
  console.log("\nE2E cleanup complete!");
  process.exit(0);
}

cleanup().catch((err) => {
  console.error("E2E cleanup failed:", err);
  process.exit(1);
});
