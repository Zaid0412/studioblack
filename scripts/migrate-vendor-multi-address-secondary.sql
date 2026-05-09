-- Vendor multi-address + secondary contact slot
--
-- 1. `vendor.addresses JSONB[]` — replaces the single `vendor.address` JSONB
--    column with an array so a vendor can carry HQ + warehouse + billing
--    offices etc. Each element follows `vendorAddressSchema` in
--    src/lib/validations.ts: { line1, line2, city, region, postal, country,
--    label?, is_primary? }. Existing single addresses are auto-migrated to
--    a one-element array on the new column.
--
--    The old `vendor.address` column is intentionally LEFT IN PLACE. App
--    code stops reading/writing it after this migration. A follow-up PR
--    will drop it once the new column has been live for a sprint.
--
-- 2. `vendor_contact.is_secondary BOOLEAN` — mirrors `is_primary`. The
--    spec calls for two named contact slots ("Main" + "Secondary") plus
--    optional additional contacts. Unique partial index enforces at most
--    one secondary per vendor (matching the existing primary-contact
--    constraint).
--
-- Run: psql $DATABASE_URL -f scripts/migrate-vendor-multi-address-secondary.sql

BEGIN;

ALTER TABLE vendor
  ADD COLUMN IF NOT EXISTS addresses JSONB[] NOT NULL DEFAULT '{}';

-- One-time backfill: copy any existing single address into the new array.
UPDATE vendor
   SET addresses = ARRAY[address]
 WHERE address IS NOT NULL
   AND addresses = '{}';

ALTER TABLE vendor_contact
  ADD COLUMN IF NOT EXISTS is_secondary BOOLEAN DEFAULT false;

CREATE UNIQUE INDEX IF NOT EXISTS vendor_contact_secondary_uk
  ON vendor_contact(vendor_id) WHERE is_secondary = true;

COMMIT;
