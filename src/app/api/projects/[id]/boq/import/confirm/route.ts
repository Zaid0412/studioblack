import crypto from "crypto";
import { NextResponse } from "next/server";
import { withAuth } from "@/lib/withAuth";
import {
  bulkInsertBoqItems,
  verifyBoqOwnership,
  withBoqImportIdempotency,
} from "@/lib/queries";
import { parseRequest, boqImportConfirmSchema } from "@/lib/validations";
import { createImportMemoryCache } from "@/lib/idempotency/memoryCache";
import { canonicalStringify } from "@/lib/json/canonical";
import type { BulkBoqImportResult } from "@/types";

/**
 * In-memory LRU fast-path in front of the Postgres-backed idempotency cache.
 * Postgres remains the cross-replica source of truth; without it, two
 * replicas could double-commit.
 */
const memoryCache = createImportMemoryCache<BulkBoqImportResult>();

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

    const key = idempotencyKey(orgId, user.id, boqId, strategy, rows);

    const memHit = memoryCache.get(key);
    if (memHit) {
      return NextResponse.json(memHit, {
        headers: { "X-Idempotent-Replay": "true" },
      });
    }

    try {
      const { result, replayed } = await withBoqImportIdempotency(key, () =>
        bulkInsertBoqItems(boqId, orgId, strategy, rows)
      );
      memoryCache.set(key, result);
      return NextResponse.json(result, {
        headers: replayed ? { "X-Idempotent-Replay": "true" } : {},
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Import failed";
      return NextResponse.json({ error: message }, { status: 500 });
    }
  }
);
