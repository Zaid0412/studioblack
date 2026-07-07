-- §14 vendor decline ("quote none").
--
-- Add `declined` to the vendor_quote status set. A decline is a current
-- vendor_quote row with status='declined' and zero line items (the reason
-- lives in `notes`). Additive; existing rows unaffected. Run once per env.

BEGIN;

ALTER TABLE vendor_quote DROP CONSTRAINT IF EXISTS vendor_quote_status_check;
ALTER TABLE vendor_quote
  ADD CONSTRAINT vendor_quote_status_check
    CHECK (status IN (
      'submitted', 'under_review', 'awarded', 'rejected', 'expired', 'declined'
    ));

COMMIT;
