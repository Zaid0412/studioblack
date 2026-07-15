-- Per-project BOQ line increment. BOQ line numbers are spaced by this value
-- (default 10 → 10, 20, 30…) so rows can be inserted between two others without
-- renumbering. Configurable per project via the project Settings page.
--
-- NOT NULL DEFAULT 10 fills existing rows, so no backfill is needed.
--
-- Run: psql $DATABASE_URL -f scripts/migrate-project-line-increment.sql

ALTER TABLE project
  ADD COLUMN IF NOT EXISTS line_increment INTEGER NOT NULL DEFAULT 10;
