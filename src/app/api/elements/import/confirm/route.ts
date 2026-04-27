import crypto from "crypto";
import { NextResponse } from "next/server";
import { withAuth } from "@/lib/withAuth";
import {
  bulkUpsertElements,
  withImportIdempotency,
  type BulkElementImportResult,
} from "@/lib/queries";
import { parseRequest, importConfirmSchema } from "@/lib/validations";
import { createImportMemoryCache } from "@/lib/idempotency/memoryCache";
import { canonicalStringify } from "@/lib/json/canonical";

/**
 * In-memory LRU fast-path in front of the Postgres-backed idempotency cache.
 * Covers the common case — double-click on the same replica — without a DB
 * round-trip. Postgres (`element_import_idempotency`) remains the cross-
 * replica source of truth; without it, two replicas could double-commit.
 */
const memoryCache = createImportMemoryCache<BulkElementImportResult>();

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

    const memHit = memoryCache.get(key);
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
      memoryCache.set(key, result);
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
