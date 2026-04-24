-- Feature 6: BOQ Excel Import/Export
-- Idempotency store so two replicas (or a double-click) can't double-commit a
-- confirmed import. Mirrors `element_import_idempotency` from F3.
--
-- Key is the sha256 of (orgId:userId:boqId:strategy:canonicalRows); value is
-- the BulkBoqImportResult we first returned. Replays within TTL return the
-- cached row. Rows older than the TTL are pruned opportunistically on every
-- write — see `withBoqImportIdempotency` in `src/lib/queries/boq.ts`.

CREATE TABLE IF NOT EXISTS boq_import_idempotency (
  key text PRIMARY KEY,
  result jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_boq_import_idempotency_created_at
  ON boq_import_idempotency (created_at);
