import { Pool } from "pg";
import { env } from "@/env";
import { logger } from "@/lib/logger";

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
    globalForPg.pgPool.on("error", (err) => {
      logger.error("Unexpected PostgreSQL pool error", { error: err });
    });
    // Drain connections on graceful shutdown (relevant for long-lived processes)
    const shutdown = () => globalForPg.pgPool?.end();
    process.once("SIGTERM", shutdown);
    process.once("SIGINT", shutdown);
  }
  return globalForPg.pgPool;
}
