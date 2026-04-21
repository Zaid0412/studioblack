-- Feature 3 follow-up: (org_id, code) lookup index.
--
-- `scripts/migrate-element-versions.sql` dropped `uq_element_org_code`, which
-- also removed the underlying index. Every code-uniqueness SELECT now falls
-- back to `idx_element_org` + post-filter, which degrades sharply on 10k-row
-- imports. This plain composite index is a drop-in replacement for the
-- dropped unique index without re-imposing DB-level code uniqueness.
--
-- Run outside a transaction so the index build is CONCURRENTLY (non-blocking).
-- psql:
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f scripts/migrate-element-code-index.sql

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_element_org_code
  ON element(org_id, code);
