-- Feature 3 follow-up: persistent idempotency cache for element import confirm.
--
-- The in-memory Map in `src/app/api/elements/import/confirm/route.ts` only
-- covers a single Node process — double-clicks routed to a different replica
-- (or after a cold-start restart) would double-commit. This table is the
-- source of truth; the in-memory LRU sits in front of it as a fast-path.
--
-- Rows older than 10 minutes are pruned opportunistically on every write.

CREATE TABLE IF NOT EXISTS element_import_idempotency (
  key text PRIMARY KEY,
  result jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_element_import_idempotency_created_at
  ON element_import_idempotency (created_at);
