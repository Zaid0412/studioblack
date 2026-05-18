-- Feature 9: RFQ Workflow (DB)
-- Studio sends a Request-For-Quote package (one or more BOQ items) to one
-- or more vendors. Vendor quote submission ships in F10; F9 stops at
-- "invited" — `rfq_vendor` tracks who was sent the package.
--
-- Note on `rfq_item.awarded_quote_item_id`: this column is the eventual
-- pointer to `vendor_quote_item(id)`, but that table doesn't exist yet
-- (lands in F10). The FK constraint is added in F10's migration; in F9
-- the column is untyped UUID and no code path writes to it.

CREATE TABLE IF NOT EXISTS rfq (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- `org_id` mirrors every other tenant-scoped table (vendor, rate_contract,
  -- audit_event) so RBAC and `getNextSequenceNumber(orgId, ...)` don't have
  -- to join to project on every read.
  org_id TEXT NOT NULL REFERENCES "organization"(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES project(id) ON DELETE CASCADE,
  -- `RFQ-{YEAR}-{SEQ}` from sequence_counter (introduced by migrate-boq.sql).
  -- Per-org unique to match how the counter increments — a global UNIQUE
  -- would collide across orgs sharing the same year/seq pair.
  rfq_number VARCHAR(50) NOT NULL,
  title VARCHAR(255) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','issued','quotes_received','under_review','awarded','cancelled')),
  issued_date DATE,
  response_deadline DATE,
  award_date DATE,
  awarded_vendor_id UUID REFERENCES vendor(id) ON DELETE SET NULL,
  scope_of_work TEXT,
  terms_conditions TEXT,
  attachments JSONB,
  created_by TEXT REFERENCES "user"(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (org_id, rfq_number)
);

CREATE TABLE IF NOT EXISTS rfq_item (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rfq_id UUID NOT NULL REFERENCES rfq(id) ON DELETE CASCADE,
  -- RESTRICT so deleting a BOQ item with live RFQ refs surfaces an error
  -- rather than orphaning scope. The BOQ delete path catches 23503 and
  -- shows a "linked to RFQ" message.
  boq_item_id UUID NOT NULL REFERENCES boq_item(id) ON DELETE RESTRICT,
  description TEXT NOT NULL,
  unit VARCHAR(30) NOT NULL,
  quantity NUMERIC(12,3) NOT NULL,
  spec_notes TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  -- Split-award support: different vendors can win different items.
  -- Populated by F11 award flow; left null in F9.
  awarded_vendor_id UUID REFERENCES vendor(id) ON DELETE SET NULL,
  awarded_quote_item_id UUID  -- FK to vendor_quote_item added in F10
);

-- Join table tracking which vendors were invited to bid. Independent of
-- `rfq.awarded_vendor_id` (single, post-award) — we need the full invited
-- set even when no awards exist yet (e.g. listing "RFQs you've been sent"
-- in the vendor portal). F10 will extend this table with quote_status etc.
CREATE TABLE IF NOT EXISTS rfq_vendor (
  rfq_id UUID NOT NULL REFERENCES rfq(id) ON DELETE CASCADE,
  vendor_id UUID NOT NULL REFERENCES vendor(id) ON DELETE CASCADE,
  invited_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  invited_by TEXT REFERENCES "user"(id) ON DELETE SET NULL,
  PRIMARY KEY (rfq_id, vendor_id)
);

CREATE INDEX IF NOT EXISTS idx_rfq_project ON rfq(project_id);
CREATE INDEX IF NOT EXISTS idx_rfq_org_status ON rfq(org_id, status);
CREATE INDEX IF NOT EXISTS idx_rfq_item_rfq ON rfq_item(rfq_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_rfq_item_boq ON rfq_item(boq_item_id);
CREATE INDEX IF NOT EXISTS idx_rfq_vendor_vendor ON rfq_vendor(vendor_id);
