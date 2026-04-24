import crypto from "crypto";
import { NextResponse } from "next/server";
import { withAuth } from "@/lib/withAuth";
import {
  bulkInsertBoqItems,
  getBoqStatus,
  verifyBoqOwnership,
  withBoqImportIdempotency,
} from "@/lib/queries";
import { parseRequest, boqImportConfirmSchema } from "@/lib/validations";
import type { BulkBoqImportResult } from "@/types";

/**
 * In-memory LRU fast-path in front of the Postgres-backed idempotency cache.
 * Covers the common case — double-click on the same replica — without a DB
 * round-trip. Postgres is the cross-replica source of truth.
 */
const MEMORY_CACHE_MAX = 256;
const MEMORY_CACHE_TTL_MS = 10 * 60 * 1000;
const memoryCache = new Map<
  string,
  { at: number; result: BulkBoqImportResult }
>();

function memCacheGet(key: string): BulkBoqImportResult | null {
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

function memCacheSet(key: string, result: BulkBoqImportResult): void {
  if (memoryCache.has(key)) memoryCache.delete(key);
  while (memoryCache.size >= MEMORY_CACHE_MAX) {
    const oldest = memoryCache.keys().next().value;
    if (oldest === undefined) break;
    memoryCache.delete(oldest);
  }
  memoryCache.set(key, { at: Date.now(), result });
}

/**
 * Stable, field-sorted JSON so key order in the request body doesn't bypass
 * the idempotency cache. Copied from the F3 confirm route; keep in sync.
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
  boqId: string,
  strategy: string,
  rows: unknown
): string {
  const hash = crypto.createHash("sha256");
  hash.update(`${orgId}:${userId}:${boqId}:${strategy}:`);
  hash.update(canonicalStringify(rows));
  return hash.digest("hex");
}

/**
 * POST /api/projects/[id]/boq/import/confirm
 * Executes a previously-validated import. The server re-validates every row
 * against `boqImportConfirmSchema` — never trusts the first-pass parse.
 */
export const POST = withAuth(
  {
    blockedRoles: ["client"],
    projectAccess: true,
    rateLimit: { limit: 10, windowMs: 60_000 },
  },
  async (req, { orgId, user }, params) => {
    if (!orgId) {
      return NextResponse.json({ error: "No organisation" }, { status: 400 });
    }

    const parsed = await parseRequest(req, boqImportConfirmSchema);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }
    const { boqId, strategy, rows } = parsed.data;

    const owned = await verifyBoqOwnership(boqId, params.id);
    if (!owned) {
      return NextResponse.json(
        { error: "BOQ not found in this project" },
        { status: 404 }
      );
    }

    // Re-check status at confirm time — the BOQ could have been locked
    // between the preview call and this call.
    const status = await getBoqStatus(boqId, params.id);
    if (status === "locked" || status === "superseded") {
      return NextResponse.json(
        {
          error: "This BOQ is locked and can no longer be edited.",
          code: "BOQ_LOCKED",
        },
        { status: 423 }
      );
    }

    const key = idempotencyKey(orgId, user.id, boqId, strategy, rows);

    const memHit = memCacheGet(key);
    if (memHit) {
      return NextResponse.json(memHit, {
        headers: { "X-Idempotent-Replay": "true" },
      });
    }

    try {
      const { result, replayed } = await withBoqImportIdempotency(key, () =>
        bulkInsertBoqItems(boqId, orgId, strategy, rows)
      );
      memCacheSet(key, result);
      return NextResponse.json(result, {
        headers: replayed ? { "X-Idempotent-Replay": "true" } : {},
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Import failed";
      return NextResponse.json({ error: message }, { status: 500 });
    }
  }
);
