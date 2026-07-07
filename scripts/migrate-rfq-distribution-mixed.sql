-- §11 RFQ distribution — richer tracking.
--
-- 1. Allow `mixed` as a distribution method (a vendor reached through more than
--    one channel — e.g. emailed at issue, then a WhatsApp reminder logged).
-- 2. Snapshot the contact the RFQ was sent to (`contact_name`).
--
-- Additive + idempotent. Run once per environment.

BEGIN;

ALTER TABLE rfq_vendor
  DROP CONSTRAINT IF EXISTS rfq_vendor_distribution_method_check;
ALTER TABLE rfq_vendor
  ADD CONSTRAINT rfq_vendor_distribution_method_check
    CHECK (distribution_method IN ('portal', 'email', 'whatsapp', 'manual', 'mixed'));

ALTER TABLE rfq_vendor
  ADD COLUMN IF NOT EXISTS contact_name TEXT;

COMMIT;
