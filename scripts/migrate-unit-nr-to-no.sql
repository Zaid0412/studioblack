-- Rename the "Number" unit code from `nr` to `no` (the standard
-- construction abbreviation, e.g. "10 nos. of" → singular "no.").
--
-- Three tables store unit strings:
-- - `element` (library)
-- - `boq_item` (line items)
-- - `rate_contract_item` (rate-contract picks)
--
-- The `unit` column is `VARCHAR(30)` on all three; the value lives as raw
-- text, so a simple UPDATE per table is enough. The Zod enum and the i18n
-- keys are renamed in code; this migration aligns the data.
--
-- Run after deploying the corresponding code change. Idempotent.
--
-- Run: psql $DATABASE_URL -f scripts/migrate-unit-nr-to-no.sql

UPDATE element             SET unit = 'no' WHERE unit = 'nr';
UPDATE boq_item            SET unit = 'no' WHERE unit = 'nr';
UPDATE rate_contract_item  SET unit = 'no' WHERE unit = 'nr';
