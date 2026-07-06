-- Partial indexes supporting the prior-awards lookup in getQuoteComparison (§19).
--
-- The comparison view counts, per vendor, how many prior RFQs that vendor has
-- won (rfq.awarded_vendor_id for single awards, rfq_item.awarded_vendor_id for
-- split awards). Both columns are sparse — set only on awarded rows — so partial
-- indexes stay small and turn the per-vendor subquery scans into index probes.
--
-- Run once per environment:  psql "$DATABASE_URL" -f scripts/migrate-rfq-award-indexes.sql

CREATE INDEX IF NOT EXISTS idx_rfq_awarded_vendor
  ON rfq (awarded_vendor_id)
  WHERE awarded_vendor_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_rfq_item_awarded_vendor
  ON rfq_item (awarded_vendor_id)
  WHERE awarded_vendor_id IS NOT NULL;
