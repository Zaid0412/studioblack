-- Per-project BOQ defaults. These pre-fill new BOQs / line items so a studio
-- billing in USD, working in metric, or with a standard VAT/margin doesn't
-- re-enter it every time. All nullable — NULL means "fall back to the global
-- default" (DEFAULT_CURRENCY, DEFAULT_ELEMENT_UNIT, or the hardcoded 0/10).
--
-- Header-level (boq): currency, vat, contingency, minimum margin.
-- Item-level (boq_item): unit, service charge.
--
-- Run: psql $DATABASE_URL -f scripts/migrate-project-boq-defaults.sql

ALTER TABLE project
  ADD COLUMN IF NOT EXISTS default_currency           VARCHAR(3),
  ADD COLUMN IF NOT EXISTS default_unit               VARCHAR(30),
  ADD COLUMN IF NOT EXISTS default_vat_pct            NUMERIC(5,2),
  ADD COLUMN IF NOT EXISTS default_contingency_pct    NUMERIC(5,2),
  ADD COLUMN IF NOT EXISTS default_min_margin_pct     NUMERIC(5,2),
  ADD COLUMN IF NOT EXISTS default_service_charge_pct NUMERIC(5,2);
