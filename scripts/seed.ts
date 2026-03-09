/**
 * Seed script — creates test users in the database.
 *
 * Usage:
 *   npm run seed
 *
 * Prerequisites:
 *   1. Valid DATABASE_URL in .env.local (Supabase Postgres connection string)
 *   2. Database tables created via `npx @better-auth/cli migrate`
 *
 * Creates two users:
 *   - alex@studioblack.com (architect) → logs in to /dashboard
 *   - emily@client.com     (client)    → logs in to /client-dashboard
 *
 * Since `role` and `initials` have `input: false` in the auth config,
 * they can't be set via the public sign-up API. This script uses
 * `auth.api.signUpEmail()` to create the accounts, then updates the
 * `role` and `initials` columns directly via SQL.
 */

import dotenv from "dotenv";
import path from "path";

// Load .env.local BEFORE any other imports that read process.env
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

const SEED_PASSWORD = process.env.SEED_PASSWORD ?? "password123";

const users = [
  {
    name: "Alex Morgan",
    email: "alex@studioblack.com",
    password: SEED_PASSWORD,
    role: "architect",
    initials: "AM",
  },
  {
    name: "Emily Chen",
    email: "emily@client.com",
    password: SEED_PASSWORD,
    role: "client",
    initials: "EC",
  },
];

async function seed() {
  // Dynamic import so env vars are available when auth.ts reads DATABASE_URL
  const { auth } = await import("../src/lib/auth");
  const { Pool } = await import("pg");

  console.log("🌱 Seeding users...\n");

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  for (const u of users) {
    try {
      // Create the user via better-auth's internal API
      const result = await auth.api.signUpEmail({
        body: {
          name: u.name,
          email: u.email,
          password: u.password,
        },
      });

      if (!result?.user?.id) {
        console.log(`⚠️  ${u.email} — could not create (may already exist)`);
        continue;
      }

      // Update role + initials directly (input: false blocks API-level setting)
      await pool.query(
        `UPDATE "user" SET role = $1, initials = $2 WHERE id = $3`,
        [u.role, u.initials, result.user.id]
      );

      console.log(`✅ ${u.email} — ${u.role} (${u.initials})`);
    } catch (err: any) {
      // Handle duplicate email gracefully
      const msg = err?.message || err?.body?.message || String(err);
      if (msg.includes("already") || msg.includes("exists")) {
        console.log(`⏭️  ${u.email} — already exists, skipping`);
      } else {
        console.error(`❌ ${u.email} — ${msg}`);
      }
    }
  }

  await pool.end();
  console.log("\n✨ Seed complete!");
  process.exit(0);
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
