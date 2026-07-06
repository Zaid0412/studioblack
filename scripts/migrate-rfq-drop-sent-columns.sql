-- §11 RFQ distribution tracking.
--
-- 1. Backfill `rfq_vendor.distribution_method` for existing invites (the column
--    shipped with migrate-rfq-quote-source.sql but was never populated).
-- 2. Drop the redundant `sent_date` / `sent_by` columns — they duplicate the
--    already-used `invited_at` / `invited_by`, were never written by any code,
--    and are entirely NULL. Keeping them invites two-sources-of-truth drift.
--
-- Idempotent + additive-safe. Run once per environment.

BEGIN;

-- Backfill: `email` if the vendor has a receives_rfq contact (the issue
-- fan-out would have emailed them), else `portal` (portal-only invite).
-- Derived from current contact config — best available for historical rows.
UPDATE rfq_vendor rv
   SET distribution_method = CASE
     WHEN EXISTS (
       SELECT 1 FROM vendor_contact vc
       WHERE vc.vendor_id = rv.vendor_id AND vc.receives_rfq = true
     ) THEN 'email' ELSE 'portal' END
 WHERE rv.distribution_method IS NULL;

-- Retire the dead sent-tracking columns.
ALTER TABLE rfq_vendor
  DROP COLUMN IF EXISTS sent_date,
  DROP COLUMN IF EXISTS sent_by;

COMMIT;
