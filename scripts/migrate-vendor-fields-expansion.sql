-- Vendor field expansion
--
-- Adds the fields requested for the India-focused vendor profile:
--   - gstin               TEXT          (GST Identification Number, 15-char)
--   - website             TEXT
--   - preferred_vendor    BOOLEAN       (vendor-wide flag — distinct from
--                                        vendor_trade.proficiency_level which
--                                        is per-category)
--   - brands_supported    TEXT[]        (free-text array of brands carried)
--   - service_areas       TEXT[]        (free-text array of regions served)
--
-- IFSC code lives inside the encrypted `bank_details` JSONB envelope; no
-- schema change is needed for that — only the TS type / Zod schema gain
-- an `ifsc_code` field.
--
-- Run: psql $DATABASE_URL -f scripts/migrate-vendor-fields-expansion.sql

BEGIN;

ALTER TABLE vendor
  ADD COLUMN IF NOT EXISTS gstin            VARCHAR(20),
  ADD COLUMN IF NOT EXISTS website          VARCHAR(500),
  ADD COLUMN IF NOT EXISTS preferred_vendor BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS brands_supported TEXT[]  NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS service_areas    TEXT[]  NOT NULL DEFAULT '{}';

-- Partial index so the "Preferred vendors only" filter is cheap even on
-- large orgs (most rows will be false).
CREATE INDEX IF NOT EXISTS idx_vendor_preferred
  ON vendor(org_id) WHERE preferred_vendor = true;

COMMIT;
