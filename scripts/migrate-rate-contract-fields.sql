-- Feature 7.5 follow-up: richer rate-contract metadata (PRD field breadth).
-- Header: contract type + commercial terms. Items: description, qty bounds,
-- lead time, per-line validity. All nullable / additive — no backfill needed.

BEGIN;

ALTER TABLE rate_contract
  ADD COLUMN IF NOT EXISTS contract_type VARCHAR(20)
    CHECK (contract_type IN ('material','labor','equipment','subcontract','mixed')),
  ADD COLUMN IF NOT EXISTS credit_period_days INTEGER
    CHECK (credit_period_days IS NULL OR credit_period_days >= 0),
  ADD COLUMN IF NOT EXISTS delivery_terms VARCHAR(100),
  ADD COLUMN IF NOT EXISTS price_basis VARCHAR(20)
    CHECK (price_basis IN ('supply','supply_install')),
  ADD COLUMN IF NOT EXISTS renewal_date DATE;

ALTER TABLE rate_contract_item
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS min_qty NUMERIC(12,2)
    CHECK (min_qty IS NULL OR min_qty >= 0),
  ADD COLUMN IF NOT EXISTS max_qty NUMERIC(12,2)
    CHECK (max_qty IS NULL OR max_qty >= 0),
  ADD COLUMN IF NOT EXISTS lead_time_days INTEGER
    CHECK (lead_time_days IS NULL OR lead_time_days >= 0),
  ADD COLUMN IF NOT EXISTS valid_until DATE,
  ADD CONSTRAINT chk_rci_qty_range
    CHECK (min_qty IS NULL OR max_qty IS NULL OR max_qty >= min_qty);

COMMIT;
