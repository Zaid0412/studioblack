-- RFQ-2: quote versioning.
-- Every revision becomes a NEW vendor_quote row (its line items stay attached),
-- and the live one is flagged is_current. History = all rows for a (rfq, vendor)
-- ordered by version. Existing quotes become v1, is_current=true. Additive.

BEGIN;

ALTER TABLE vendor_quote
  ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS is_current BOOLEAN NOT NULL DEFAULT true;

-- The "one quote per (rfq, vendor)" rule now applies only to the current row —
-- historical versions coexist. Swap the hard UNIQUE for a partial unique index.
ALTER TABLE vendor_quote
  DROP CONSTRAINT IF EXISTS vendor_quote_unique_per_rfq_vendor;
CREATE UNIQUE INDEX IF NOT EXISTS vendor_quote_one_current_per_rfq_vendor
  ON vendor_quote (rfq_id, vendor_id) WHERE is_current;
CREATE INDEX IF NOT EXISTS idx_vendor_quote_versions
  ON vendor_quote (rfq_id, vendor_id, version);

COMMIT;
