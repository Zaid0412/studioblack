-- Feature 2: Element Library
-- Master catalogue of construction elements with optional free-form attributes.
-- Org-scoped; code is unique within an org.

CREATE TABLE IF NOT EXISTS element (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id TEXT NOT NULL REFERENCES "organization"(id) ON DELETE CASCADE,
  code VARCHAR(50) NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  category_id UUID REFERENCES element_category(id) ON DELETE SET NULL,
  unit VARCHAR(30) NOT NULL,
  unit_cost NUMERIC(12,2) NOT NULL DEFAULT 0,
  currency VARCHAR(3) NOT NULL DEFAULT 'USD',
  material_cost NUMERIC(12,2),
  labour_cost NUMERIC(12,2),
  overhead_pct NUMERIC(5,2) DEFAULT 0,
  margin_pct NUMERIC(5,2) DEFAULT 0,
  spec_reference VARCHAR(255),
  drawing_ref VARCHAR(255),
  tags TEXT[],
  is_active BOOLEAN DEFAULT true,
  created_by TEXT REFERENCES "user"(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT uq_element_org_code UNIQUE (org_id, code)
);

CREATE TABLE IF NOT EXISTS element_attribute (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  element_id UUID NOT NULL REFERENCES element(id) ON DELETE CASCADE,
  attribute_key VARCHAR(100) NOT NULL,
  attribute_value TEXT NOT NULL,
  unit VARCHAR(30),
  sort_order INTEGER DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_element_org ON element(org_id);
CREATE INDEX IF NOT EXISTS idx_element_category ON element(category_id);
CREATE INDEX IF NOT EXISTS idx_element_active ON element(is_active);
CREATE INDEX IF NOT EXISTS idx_element_tags ON element USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_element_attr_element ON element_attribute(element_id);
