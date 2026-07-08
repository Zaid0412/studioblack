-- Rate-contract completeness: multiple signed-document attachments.
--
-- Replace the single `agreement_url` column with a JSONB `attachments` array
-- ({url, fileName}[]), mirroring vendor_quote.attachments (§15). Back-compat:
-- the existing signed agreement is migrated to the first attachment.
--
-- Run once per environment.

BEGIN;

ALTER TABLE rate_contract ADD COLUMN IF NOT EXISTS attachments JSONB;

-- Wrap the single agreement_url as one attachment (no filename was stored).
UPDATE rate_contract
   SET attachments = jsonb_build_array(
         jsonb_build_object('url', agreement_url, 'fileName', 'Signed agreement')
       )
 WHERE agreement_url IS NOT NULL AND attachments IS NULL;

ALTER TABLE rate_contract DROP COLUMN IF EXISTS agreement_url;

COMMIT;
