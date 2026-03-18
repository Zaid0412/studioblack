import { Pool } from "pg";

/**
 * Shared PostgreSQL connection pool.
 *
 * Lazy-initialized singleton — reuses the same pool across all server-side
 * code (API routes, server components, server actions). Uses the same
 * DATABASE_URL as better-auth.
 */
let pool: Pool | null = null;

/** Returns the shared PostgreSQL connection pool, creating it on first call. */
export function getPool(): Pool {
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });
  }
  return pool;
}
