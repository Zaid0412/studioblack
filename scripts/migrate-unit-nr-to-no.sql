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
-- ── DEPLOY ORDERING ────────────────────────────────────────────────────
-- Run this migration BEFORE OR WITH the code deploy. Otherwise:
--   - Existing rows with unit='nr' fail the strict Zod enum the moment
--     a user tries to edit them via PATCH.
--   - The UnitSelect dropdown shows blank for those rows because 'nr' is
--     no longer in the option list.
--
-- ── RELEASE-NOTE FOR CUSTOMERS ────────────────────────────────────────
-- BOQ / element Excel imports validate `unit` against ALLOWED_UNITS and
-- lowercase the input. Customer spreadsheets that still contain the
-- string "nr" will fail import after this rename. Affected users should
-- find-replace "nr" → "no" in their templates.
--
-- Idempotent (no-op on second run).
--
-- Run: psql $DATABASE_URL -f scripts/migrate-unit-nr-to-no.sql

UPDATE element             SET unit = 'no' WHERE unit = 'nr';
UPDATE boq_item            SET unit = 'no' WHERE unit = 'nr';
UPDATE rate_contract_item  SET unit = 'no' WHERE unit = 'nr';
