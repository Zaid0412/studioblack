-- A rate contract now names the Service Area it covers, on the header.
--
-- Nullable, and NOT backfilled: there is nothing to derive it from. A contract's
-- area can't be inferred from its items — most existing contracts have no items
-- at all, and the ones that do can span several areas (dev's RC-2026-001 prices
-- three items across two). So existing contracts are grandfathered exactly like
-- elements were: the column stays nullable, and the rule is enforced on write
-- (create, and any edit), so old rows heal the first time someone touches them.
--
-- ON DELETE RESTRICT, matching rate_contract_item.category_id: a Service Area
-- that a contract points at must not be deletable out from under it.
--
-- Run: psql $DATABASE_URL -f scripts/migrate-rate-contract-header-service-area.sql

BEGIN;

ALTER TABLE rate_contract
  ADD COLUMN IF NOT EXISTS category_id UUID
    REFERENCES element_category(id) ON DELETE RESTRICT;

-- FK child columns need their own index or PG seq-scans rate_contract on every
-- element_category delete to enforce the RESTRICT.
CREATE INDEX IF NOT EXISTS idx_rate_contract_category
  ON rate_contract (category_id);

COMMIT;
