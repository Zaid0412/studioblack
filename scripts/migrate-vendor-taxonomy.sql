-- Vendor Taxonomy (PR 1): vendor category tree
--
-- A SEPARATE vendor classification tree (distinct from element_category). Vendors
-- are classified by their own categories/sub-categories so the vendor taxonomy can
-- diverge from the construction-element taxonomy. See docs/vendor-taxonomy-plan.md.
--
-- PR 1 ships the tree + management UI only. Wiring vendors to it (vendor_category_map),
-- structured service areas, and the element-category bridge land in later PRs.
--
-- Run: psql $DATABASE_URL -f scripts/migrate-vendor-taxonomy.sql

BEGIN;

CREATE TABLE IF NOT EXISTS vendor_category (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id TEXT NOT NULL REFERENCES "organization"(id) ON DELETE CASCADE,
  name VARCHAR(150) NOT NULL,
  parent_id UUID REFERENCES vendor_category(id) ON DELETE CASCADE,
  level INTEGER NOT NULL CHECK (level BETWEEN 1 AND 3),
  -- Short code per the Vendor Master Taxonomy tab (e.g. JOIN, FLR, FIN).
  code VARCHAR(10),
  sort_order INTEGER DEFAULT 0,
  icon VARCHAR(50),
  color VARCHAR(7),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vendor_category_org ON vendor_category(org_id);
CREATE INDEX IF NOT EXISTS idx_vendor_category_parent ON vendor_category(parent_id);
CREATE INDEX IF NOT EXISTS idx_vendor_category_level ON vendor_category(level);

-- Level 1 has no parent; levels 2-3 must have a parent (mirrors element_category).
ALTER TABLE vendor_category DROP CONSTRAINT IF EXISTS chk_vendor_category_parent_level;
ALTER TABLE vendor_category ADD CONSTRAINT chk_vendor_category_parent_level
  CHECK (
    (level = 1 AND parent_id IS NULL)
    OR (level IN (2, 3) AND parent_id IS NOT NULL)
  );

COMMIT;
