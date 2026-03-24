import { Pool } from "pg";
import { env } from "@/env";

/**
 * Shared PostgreSQL connection pool.
 *
 * Lazy-initialized singleton — reuses the same pool across all server-side
 * code (API routes, server components, server actions). Uses the same
 * DATABASE_URL as better-auth.
 *
 * Uses globalThis to survive Next.js dev-mode hot reloads without leaking
 * connections (each HMR cycle re-evaluates modules but globalThis persists).
 */
const globalForPg = globalThis as unknown as { pgPool?: Pool };

/** Returns the shared PostgreSQL connection pool, creating it on first call. */
export function getPool(): Pool {
  if (!globalForPg.pgPool) {
    globalForPg.pgPool = new Pool({
      connectionString: env().DATABASE_URL,
      max: 5,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });
  }
  return globalForPg.pgPool;
}
