-- Default currency for new rows becomes INR (was USD).
--
-- Column DEFAULTs only. Existing rows are NOT touched: the currency column says
-- what the number beside it means, so rewriting 'USD' → 'INR' would silently
-- reinterpret every stored amount rather than convert it. Old rows keep USD and
-- keep rendering as USD; only rows created from now on default to INR.
--
-- The app almost always sends an explicit currency (see DEFAULT_CURRENCY in
-- src/lib/constants.ts), so these DEFAULTs are the backstop for any insert that
-- omits the column — they must not disagree with the app.

BEGIN;

ALTER TABLE element       ALTER COLUMN currency SET DEFAULT 'INR';
ALTER TABLE boq           ALTER COLUMN currency SET DEFAULT 'INR';
ALTER TABLE rate_contract ALTER COLUMN currency SET DEFAULT 'INR';
ALTER TABLE vendor        ALTER COLUMN currency SET DEFAULT 'INR';
ALTER TABLE vendor_quote  ALTER COLUMN currency SET DEFAULT 'INR';

COMMIT;
