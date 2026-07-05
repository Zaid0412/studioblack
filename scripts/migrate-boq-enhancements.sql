-- F6.1: BOQ table enhancements — provenance + service-charge pricing.
-- Shipped in PR #81 (2026-04-29).

BEGIN;

-- 1. boq_item.source — provenance of how the row landed in the BOQ.
--    Set by the create flow; not user-editable.
ALTER TABLE boq_item
  ADD COLUMN IF NOT EXISTS source VARCHAR(20) NOT NULL DEFAULT 'custom'
    CHECK (source IN ('custom','library','project','rate_contract'));

-- Backfill: any pre-existing row already linked to an element came from
-- the library picker. Custom rows with element_id NULL stay 'custom'.
UPDATE boq_item
   SET source = 'library'
 WHERE source = 'custom' AND element_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_boq_item_source ON boq_item(boq_id, source);

-- 2. service_charge_pct on boq_item — applied between overhead and margin.
ALTER TABLE boq_item
  ADD COLUMN IF NOT EXISTS service_charge_pct NUMERIC(5,2) DEFAULT 0;

-- 3. service_charge_pct on element so it default-flows through addElementToBoq.
ALTER TABLE element
  ADD COLUMN IF NOT EXISTS service_charge_pct NUMERIC(5,2) DEFAULT 0;

COMMIT;
