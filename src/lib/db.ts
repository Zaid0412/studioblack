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
      // Each warm serverless instance keeps its own pool, so cap it small: a
      // single invocation serves one request at a time, and prod connects
      // through the Supabase transaction pooler (:6543 ?pgbouncer=true), which
      // multiplexes. A larger `max` just squats pooler slots across instances.
      max: 2,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });
    globalForPg.pgPool.on("error", (err) => {
      logger.error("Unexpected PostgreSQL pool error", { error: err });
    });
    // Drain connections on graceful shutdown. A second `end()` (both signals
    // fire, or one is redelivered) returns a rejected promise rather than
    // throwing, so the `.catch` swallows it — no unhandled rejection, and the
    // pool still drains exactly once.
    const shutdown = () => void globalForPg.pgPool?.end().catch(() => {});
    process.once("SIGTERM", shutdown);
    process.once("SIGINT", shutdown);
  }
  return globalForPg.pgPool;
}
