/**
 * Seed E2E test users in the database.
 *
 * Usage:
 *   npx tsx scripts/seed-e2e.ts
 *
 * Creates test users with verified emails for Playwright E2E tests.
 * Uses `e2e-*@test.studioblack.com` email pattern so they're easy to identify and clean up.
 *
 * Prerequisites:
 *   1. Valid DATABASE_URL in .env.local
 *   2. Database tables created via `npx @better-auth/cli migrate`
 */

import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

const E2E_PASSWORD = process.env.E2E_PASSWORD ?? "TestPassword123!";

const users = [
  {
    name: "E2E PM User",
    email: process.env.E2E_PM_EMAIL ?? "e2e-pm@test.studioblack.com",
    role: "pm",
    initials: "EP",
  },
  {
    name: "E2E Architect User",
    email:
      process.env.E2E_ARCHITECT_EMAIL ?? "e2e-architect@test.studioblack.com",
    role: "architect",
    initials: "EA",
  },
];

async function seedE2E() {
  const { auth } = await import("../src/lib/auth");
  const pg = await import("pg");
  const Pool = pg.default?.Pool ?? pg.Pool;

  console.log("Seeding E2E test users...\n");

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  for (const u of users) {
    try {
      // Check if user already exists
      const { rows: existing } = await pool.query(
        `SELECT id FROM "user" WHERE email = $1`,
        [u.email]
      );

      if (existing.length > 0) {
        // Update existing user to ensure correct state
        await pool.query(
          `UPDATE "user" SET role = $1, initials = $2, "emailVerified" = true WHERE id = $3`,
          [u.role, u.initials, existing[0].id]
        );
        console.log(`  ${u.email} — already exists, updated`);
        continue;
      }

      // Create user via better-auth API
      const result = await auth.api.signUpEmail({
        body: { name: u.name, email: u.email, password: E2E_PASSWORD },
      });

      if (!result?.user?.id) {
        console.log(`  ${u.email} — could not create`);
        continue;
      }

      // Set role, initials, and verify email
      await pool.query(
        `UPDATE "user" SET role = $1, initials = $2, "emailVerified" = true WHERE id = $3`,
        [u.role, u.initials, result.user.id]
      );

      console.log(`  ${u.email} — created (${u.role})`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("already") || msg.includes("exists")) {
        console.log(`  ${u.email} — already exists, skipping`);
      } else {
        console.error(`  ${u.email} — ERROR: ${msg}`);
      }
    }
  }

  // Create an organization for the PM and add architect as member
  try {
    const { rows: pmRows } = await pool.query(
      `SELECT id FROM "user" WHERE email = $1`,
      [users[0].email]
    );
    const { rows: archRows } = await pool.query(
      `SELECT id FROM "user" WHERE email = $1`,
      [users[1].email]
    );

    if (pmRows.length > 0 && archRows.length > 0) {
      const pmId = pmRows[0].id;
      const archId = archRows[0].id;

      // Check if org already exists
      const { rows: orgRows } = await pool.query(
        `SELECT o.id FROM "organization" o
         JOIN "member" m ON m."organizationId" = o.id
         WHERE m."userId" = $1 AND m.role = 'owner' AND o.name = 'E2E Test Org'`,
        [pmId]
      );

      let orgId: string;
      if (orgRows.length > 0) {
        orgId = orgRows[0].id;
        console.log(`  E2E Test Org — already exists`);
      } else {
        // Create org directly via SQL (better-auth API requires a session context)
        const { rows: newOrg } = await pool.query(
          `INSERT INTO "organization" (id, name, slug, "createdAt")
           VALUES (gen_random_uuid(), 'E2E Test Org', 'e2e-test-org', NOW())
           ON CONFLICT (slug) DO UPDATE SET name = 'E2E Test Org'
           RETURNING id`
        );
        orgId = newOrg[0].id;

        // Add PM as owner
        await pool.query(
          `INSERT INTO "member" (id, "organizationId", "userId", role, "createdAt")
           VALUES (gen_random_uuid(), $1, $2, 'owner', NOW())
           ON CONFLICT DO NOTHING`,
          [orgId, pmId]
        );
        console.log(`  E2E Test Org — created`);
      }

      // Add architect as member (ignore if already exists)
      const { rowCount } = await pool.query(
        `INSERT INTO "member" (id, "organizationId", "userId", role, "createdAt")
         VALUES (gen_random_uuid(), $1, $2, 'member', NOW())
         ON CONFLICT DO NOTHING`,
        [orgId, archId]
      );
      console.log(`  Architect added to E2E Test Org`);

      // Set active org for both users (better-auth uses session-level activeOrgId,
      // but we can also set it in the "session" table if needed)
    }
  } catch (err) {
    console.error(
      `  Org setup error: ${err instanceof Error ? err.message : String(err)}`
    );
  }

  await pool.end();
  console.log("\nE2E seed complete!");
  process.exit(0);
}

seedE2E().catch((err) => {
  console.error("E2E seed failed:", err);
  process.exit(1);
});
