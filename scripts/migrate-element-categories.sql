-- Feature 1: Element Categories
-- 3-level hierarchical category tree for construction materials/work items.

CREATE TABLE element_category (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id TEXT NOT NULL REFERENCES "organization"(id) ON DELETE CASCADE,
  name VARCHAR(150) NOT NULL,
  parent_id UUID REFERENCES element_category(id) ON DELETE CASCADE,
  level INTEGER NOT NULL CHECK (level BETWEEN 1 AND 3),
  code_prefix VARCHAR(10),
  sort_order INTEGER DEFAULT 0,
  icon VARCHAR(50),
  color VARCHAR(7),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_element_category_org ON element_category(org_id);
CREATE INDEX idx_element_category_parent ON element_category(parent_id);
CREATE INDEX idx_element_category_level ON element_category(level);

-- Level 1 must have no parent; levels 2-3 must have a parent
ALTER TABLE element_category ADD CONSTRAINT chk_parent_level
  CHECK (
    (level = 1 AND parent_id IS NULL)
    OR (level IN (2, 3) AND parent_id IS NOT NULL)
  );
