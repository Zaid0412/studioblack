-- Add `name` to `boq_item`.
--
-- The BOQ item form has always had a `Name` input, but it was only
-- persisted when the user also toggled "Save to element library" — in
-- that case the name moved onto the new `element` row. Without the
-- toggle the input was silently discarded, so users typing a name on a
-- one-off line item saw it disappear from the row drawer.
--
-- The new column is OPTIONAL: ad-hoc lines without a typed name stay
-- NULL and the drawer falls back to the linked element's name. When
-- both are present, the BOQ item's name takes priority (user override).
--
-- Run: psql $DATABASE_URL -f scripts/migrate-boq-item-name.sql

ALTER TABLE boq_item
  ADD COLUMN IF NOT EXISTS name VARCHAR(255);
