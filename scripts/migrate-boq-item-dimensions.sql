-- Add `length`, `breadth`, `height` to `boq_item`.
--
-- Per-line measurements for items where the quantity is naturally a
-- product of physical dimensions (e.g. concrete footing 2.5×1.5×0.5 m³,
-- engineered oak flooring 5×3 m²). All three are optional, so unit-count
-- items (taps, doors, fixtures) leave them NULL and rely on `quantity`
-- alone.
--
-- The dimensions are BoQ-line specific — they intentionally don't live
-- on `element`. When a BoQ line is promoted to the element library
-- (the "Save to element library" toggle in the create-item sheet), L,
-- B, H stay only on the `boq_item` row. The element row carries
-- everything else (code, name, costs, refs, files, tags, attributes).
--
-- Run: psql $DATABASE_URL -f scripts/migrate-boq-item-dimensions.sql

ALTER TABLE boq_item
  ADD COLUMN IF NOT EXISTS length  NUMERIC(10,3),
  ADD COLUMN IF NOT EXISTS breadth NUMERIC(10,3),
  ADD COLUMN IF NOT EXISTS height  NUMERIC(10,3);
