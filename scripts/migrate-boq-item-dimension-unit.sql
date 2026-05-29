-- Add `dimension_unit` to `boq_item`.
--
-- Per-item unit of measurement for L/B/H. Existing rows backfill to 'm'
-- (the implicit unit before this column existed). Values stay numeric in
-- the existing length/breadth/height columns:
--   - 'm'  → decimal metres (e.g. 2.50)
--   - 'ft' → decimal feet   (e.g. 7.8333 for 7'10")
--
-- The UI parses/formats the feet+inches notation; the database holds the
-- raw decimal so the qty product (L × B × H) keeps working without any
-- server-side conversion logic.
--
-- Run: psql $DATABASE_URL -f scripts/migrate-boq-item-dimension-unit.sql

ALTER TABLE boq_item
  ADD COLUMN IF NOT EXISTS dimension_unit VARCHAR(2)
    NOT NULL DEFAULT 'm'
    CHECK (dimension_unit IN ('m', 'ft'));
