-- Feature 7.5 follow-up: Rate-contract items price a SERVICE AREA (taxonomy
-- leaf), with the specific element as an OPTIONAL override.
--
-- Before: rate_contract_item.element_id was NOT NULL (item == one element).
-- After:  category_id (element_category) is the primary target; element_id is
--         optional. A BOQ item matches a contract item by its element OR by its
--         element's service area (and that area's ancestors).
--
-- Backfill derives category_id from each existing item's element. Pre-flight
-- before prod: confirm no rate_contract_item references an element with a NULL
-- category_id (that row would block the NOT NULL below).

BEGIN;

ALTER TABLE rate_contract_item
  ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES element_category(id) ON DELETE RESTRICT,
  ALTER COLUMN element_id DROP NOT NULL;

-- Existing element-priced items inherit the element's own service area.
UPDATE rate_contract_item rci
   SET category_id = e.category_id
  FROM element e
 WHERE e.id = rci.element_id
   AND rci.category_id IS NULL;

-- Pre-flight: fail loudly (not via a cryptic NOT NULL error) if any row is still
-- unbackfilled because its element has no category_id. Backfill those first.
DO $$
DECLARE
  unbackfilled int;
BEGIN
  SELECT count(*) INTO unbackfilled FROM rate_contract_item WHERE category_id IS NULL;
  IF unbackfilled > 0 THEN
    RAISE EXCEPTION 'Migration aborted: % rate_contract_item row(s) have no category_id (their element has no category). Assign categories to those elements first.', unbackfilled;
  END IF;
END $$;

ALTER TABLE rate_contract_item
  ALTER COLUMN category_id SET NOT NULL;

-- Replace UNIQUE(rate_contract_id, element_id) with two partial unique indexes:
-- one service-area-only rate per (contract, area); one element-specific rate per
-- (contract, area, element).
ALTER TABLE rate_contract_item
  DROP CONSTRAINT IF EXISTS rate_contract_item_rate_contract_id_element_id_key;

CREATE UNIQUE INDEX IF NOT EXISTS uq_rci_service_area
  ON rate_contract_item (rate_contract_id, category_id)
  WHERE element_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_rci_element
  ON rate_contract_item (rate_contract_id, category_id, element_id)
  WHERE element_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_rate_contract_item_category
  ON rate_contract_item (category_id);

COMMIT;
