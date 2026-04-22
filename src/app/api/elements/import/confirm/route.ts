import crypto from "crypto";
import { NextResponse } from "next/server";
import { withAuth } from "@/lib/withAuth";
import {
  bulkUpsertElements,
  withImportIdempotency,
  type BulkElementImportResult,
} from "@/lib/queries";
import { parseRequest, importConfirmSchema } from "@/lib/validations";

/**
 * In-memory LRU fast-path in front of the Postgres-backed idempotency cache.
 * Covers the common case — double-click on the same replica — without a DB
 * round-trip. Bounded so a burst of distinct imports cannot grow the Map
 * unbounded; eviction is strict LRU via Map insertion order.
 *
 * Postgres (`element_import_idempotency`) is the cross-replica source of
 * truth; without it, two replicas could double-commit. See queries.ts
 * `withImportIdempotency` and `scripts/migrate-element-import-idempotency.sql`.
 */
const MEMORY_CACHE_MAX = 256;
const MEMORY_CACHE_TTL_MS = 10 * 60 * 1000;
const memoryCache = new Map<
  string,
  { at: number; result: BulkElementImportResult }
>();

function memCacheGet(key: string): BulkElementImportResult | null {
  const entry = memoryCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.at > MEMORY_CACHE_TTL_MS) {
    memoryCache.delete(key);
    return null;
  }
  // Mark most-recently-used by re-inserting.
  memoryCache.delete(key);
  memoryCache.set(key, entry);
  return entry.result;
}

function memCacheSet(key: string, result: BulkElementImportResult): void {
  if (memoryCache.has(key)) memoryCache.delete(key);
  while (memoryCache.size >= MEMORY_CACHE_MAX) {
    const oldest = memoryCache.keys().next().value;
    if (oldest === undefined) break;
    memoryCache.delete(oldest);
  }
  memoryCache.set(key, { at: Date.now(), result });
}

/**
 * Stable, field-sorted JSON. `JSON.stringify` preserves object key insertion
 * order, so two semantically identical payloads that differ only in key order
 * (e.g. one client sends `{code, name}`, another sends `{name, code}`) would
 * hash to different keys and bypass the idempotency cache. Sort recursively
 * so the hash is a function of content alone.
 */
function canonicalStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value))
    return `[${value.map(canonicalStringify).join(",")}]`;
  const keys = Object.keys(value as Record<string, unknown>).sort();
  const body = keys
    .map(
      (k) =>
        `${JSON.stringify(k)}:${canonicalStringify(
          (value as Record<string, unknown>)[k]
        )}`
    )
    .join(",");
  return `{${body}}`;
}

function idempotencyKey(
  orgId: string,
  userId: string,
  strategy: string,
  rows: unknown
): string {
  const hash = crypto.createHash("sha256");
  hash.update(`${orgId}:${userId}:${strategy}:`);
  hash.update(canonicalStringify(rows));
  return hash.digest("hex");
}

/**
 * POST /api/elements/import/confirm
 * Executes a previously-validated import. The server re-validates every row
 * against importConfirmSchema — we never trust the first-pass parse output.
 */
export const POST = withAuth(
  {
    allowedRoles: ["pm", "architect"],
    // Confirm allowance is looser than /import so a PM iterating on sheets
    // isn't blocked from committing after 5 preview/validate calls.
    rateLimit: { limit: 10, windowMs: 60_000 },
  },
  async (req, { orgId, user }) => {
    if (!orgId) {
      return NextResponse.json({ error: "No organisation" }, { status: 400 });
    }

    const parsed = await parseRequest(req, importConfirmSchema);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    const key = idempotencyKey(
      orgId,
      user.id,
      parsed.data.strategy,
      parsed.data.rows
    );

    const memHit = memCacheGet(key);
    if (memHit) {
      return NextResponse.json(memHit, {
        headers: { "X-Idempotent-Replay": "true" },
      });
    }

    try {
      const { result, replayed } = await withImportIdempotency(key, () =>
        bulkUpsertElements(orgId, {
          strategy: parsed.data.strategy,
          createdBy: user.id,
          rows: parsed.data.rows,
        })
      );
      memCacheSet(key, result);
      if (replayed) {
        return NextResponse.json(result, {
          headers: { "X-Idempotent-Replay": "true" },
        });
      }
      return NextResponse.json(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Import failed";
      return NextResponse.json({ error: message }, { status: 500 });
    }
  }
);
