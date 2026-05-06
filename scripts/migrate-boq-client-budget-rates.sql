-- Add `client_rate` and `budget_rate` to `element` and `boq_item`.
--
-- - `client_rate`: client-facing per-unit price, stored beside the computed
--   sell_price. Used when a project sells to clients at a rate that isn't
--   simply (cost × markups) — markup ladders, project-specific discounts.
-- - `budget_rate`: internally-targeted per-unit cost, compared against
--   `unit_cost` to answer "are we over our budget?" — variance reference,
--   never shown to clients.
--
-- Both are nullable; existing elements/items stay clean (no synthesised
-- defaults). Both inherit the BOQ's currency.
--
-- Companion plan: docs/boq-client-budget-rates-plan.md
-- Run: psql $DATABASE_URL -f scripts/migrate-boq-client-budget-rates.sql

ALTER TABLE element
  ADD COLUMN IF NOT EXISTS client_rate NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS budget_rate NUMERIC(12,2);

ALTER TABLE boq_item
  ADD COLUMN IF NOT EXISTS client_rate NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS budget_rate NUMERIC(12,2);
