-- Feature 4: BOQ Core (DB)
-- Bill of Quantities schema: one BOQ per project, with sections and line items.
-- Computed columns (total_cost, sell_price, progress_pct, margin_alert) are
-- calculated in SELECT expressions, not GENERATED ALWAYS AS — the margin_alert
-- threshold comes from the parent `boq` row so a generated column can't express it.

CREATE TABLE IF NOT EXISTS boq (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES project(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  version INTEGER DEFAULT 1,
  status VARCHAR(30) NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','submitted_to_client','client_approved','locked','superseded')),
  currency VARCHAR(3) DEFAULT 'INR',
  exchange_rate NUMERIC(10,4) DEFAULT 1,
  contingency_pct NUMERIC(5,2) DEFAULT 0,
  vat_pct NUMERIC(5,2) DEFAULT 0,
  minimum_margin_pct NUMERIC(5,2) DEFAULT 10,
  client_id TEXT REFERENCES "user"(id) ON DELETE SET NULL,
  architect_id TEXT REFERENCES "user"(id) ON DELETE SET NULL,
  issued_date DATE,
  approved_date DATE,
  notes TEXT,
  client_notes TEXT,
  -- Populated when BOQ is locked (Feature 13) for version history
  snapshot JSONB,
  created_by TEXT REFERENCES "user"(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS boq_section (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  boq_id UUID NOT NULL REFERENCES boq(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  description TEXT,
  budget_cap NUMERIC(12,2),
  is_visible_to_client BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS boq_item (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  boq_id UUID NOT NULL REFERENCES boq(id) ON DELETE CASCADE,
  section_id UUID REFERENCES boq_section(id) ON DELETE SET NULL,
  element_id UUID REFERENCES element(id) ON DELETE SET NULL,
  item_code VARCHAR(50) NOT NULL,
  description TEXT NOT NULL,
  unit VARCHAR(30) NOT NULL,
  quantity NUMERIC(12,3) NOT NULL DEFAULT 0,
  unit_cost NUMERIC(12,2) NOT NULL DEFAULT 0,
  material_cost NUMERIC(12,2),
  labour_cost NUMERIC(12,2),
  overhead_pct NUMERIC(5,2) DEFAULT 0,
  margin_pct NUMERIC(5,2) NOT NULL DEFAULT 0,
  -- Two status tracks: lifecycle (internal flow) and client_approval (client-facing)
  lifecycle_status VARCHAR(30) DEFAULT 'draft'
    CHECK (lifecycle_status IN ('draft','submitted','approved','rejected','queried','locked','change_order_pending','superseded')),
  client_approval_status VARCHAR(20) DEFAULT 'pending'
    CHECK (client_approval_status IN ('pending','approved','rejected','queried')),
  client_approved_at TIMESTAMPTZ,
  client_approved_by TEXT REFERENCES "user"(id) ON DELETE SET NULL,
  requires_reapproval BOOLEAN DEFAULT false,
  element_archived BOOLEAN DEFAULT false,
  installed_qty NUMERIC(12,3) DEFAULT 0,
  has_snag BOOLEAN DEFAULT false,
  po_status VARCHAR(20) DEFAULT 'none'
    CHECK (po_status IN ('none','rfq_issued','quoted','po_raised','delivered')),
  notes TEXT,
  client_notes TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_provisional BOOLEAN DEFAULT false,
  is_excluded BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Auto-numbering for RFQ, PO, CO, PROP sequences (and optionally BOQ item codes).
-- Used by getNextSequenceNumber() in src/lib/queries/boq.ts.
CREATE TABLE IF NOT EXISTS sequence_counter (
  org_id TEXT NOT NULL REFERENCES "organization"(id) ON DELETE CASCADE,
  prefix VARCHAR(20) NOT NULL,
  year INTEGER NOT NULL,
  current_value INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (org_id, prefix, year)
);

CREATE INDEX IF NOT EXISTS idx_boq_project ON boq(project_id);
CREATE INDEX IF NOT EXISTS idx_boq_project_version ON boq(project_id, version DESC);
CREATE INDEX IF NOT EXISTS idx_boq_section_boq ON boq_section(boq_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_boq_item_boq ON boq_item(boq_id, section_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_boq_item_section ON boq_item(section_id);
CREATE INDEX IF NOT EXISTS idx_boq_item_element ON boq_item(element_id);
CREATE INDEX IF NOT EXISTS idx_boq_item_pending_approval
  ON boq_item(boq_id) WHERE client_approval_status = 'pending';
