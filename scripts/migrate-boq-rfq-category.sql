-- Taxonomy first-class on procurement lines.
-- Root gap: the element_category tree (Category→Subcategory→ServiceArea) only
-- attached to a costable line via element.category_id, so free-text BOQ items
-- (element_id IS NULL) were unclassified — invisible to rate-contract matching
-- and vendor suggestion. This adds a direct service-area link to boq_item and a
-- snapshot on rfq_item. category_id may point at any level of the tree (leaf is
-- NOT enforced — ancestor expansion in the matcher covers upward matching).
-- Backfills existing rows from their linked element's category. Additive.
--
-- SUPERSEDED: a Service Area (level 3) is now required on every BOQ write —
-- enforced at the app layer (`checkServiceAreas`), not by a constraint, so the
-- rows that predate the rule keep reading and heal on their next save. The
-- column stays nullable for exactly that reason.

BEGIN;

ALTER TABLE boq_item
  ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES element_category(id) ON DELETE SET NULL;

ALTER TABLE rfq_item
  ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES element_category(id) ON DELETE SET NULL;

-- Backfill BOQ items from their linked element's service area.
UPDATE boq_item bi
   SET category_id = e.category_id
  FROM element e
 WHERE bi.element_id = e.id
   AND bi.category_id IS NULL
   AND e.category_id IS NOT NULL;

-- RFQ items snapshot their (now backfilled) BOQ item's category.
UPDATE rfq_item ri
   SET category_id = bi.category_id
  FROM boq_item bi
 WHERE ri.boq_item_id = bi.id
   AND ri.category_id IS NULL
   AND bi.category_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_boq_item_category ON boq_item (category_id);
CREATE INDEX IF NOT EXISTS idx_rfq_item_category ON rfq_item (category_id);

COMMIT;
