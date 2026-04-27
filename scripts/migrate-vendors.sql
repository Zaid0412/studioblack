-- Feature 7: Vendor Management
-- Vendor profiles, contacts, and trade-category mapping. Foundation for
-- F8 (Vendor Role/Portal), F9 (RFQ), F10 (Quotes).
--
-- Includes the audit_event table introduced here so F7 can log bank-details
-- access. The same table is reused by F21 once the audit feed UI lands.

CREATE TABLE IF NOT EXISTS vendor (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id TEXT NOT NULL REFERENCES "organization"(id) ON DELETE CASCADE,
  company_name VARCHAR(255) NOT NULL,
  trading_name VARCHAR(255),
  vendor_code VARCHAR(50),
  status VARCHAR(20) DEFAULT 'active'
    CHECK (status IN ('active','inactive','blacklisted','pending_approval')),
  rating NUMERIC(3,1) DEFAULT 0 CHECK (rating >= 0 AND rating <= 5),
  payment_terms VARCHAR(100),
  currency VARCHAR(3) DEFAULT 'USD',
  vat_registered BOOLEAN DEFAULT false,
  vat_number VARCHAR(50),
  -- AES-256-GCM envelope: { version, encrypted, iv, tag }. Never queried directly.
  bank_details JSONB,
  -- { line1, line2, city, region, postal, country }
  address JSONB,
  notes TEXT,
  created_by TEXT REFERENCES "user"(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vendor_org ON vendor(org_id);
CREATE INDEX IF NOT EXISTS idx_vendor_status ON vendor(status);
CREATE INDEX IF NOT EXISTS idx_vendor_company_lower ON vendor(org_id, lower(company_name));

-- Vendor codes are org-local; two orgs can both have a "V001". Partial index
-- keeps the constraint while allowing NULLs for vendors without an explicit code.
CREATE UNIQUE INDEX IF NOT EXISTS vendor_org_code_uk
  ON vendor(org_id, vendor_code) WHERE vendor_code IS NOT NULL;

CREATE TABLE IF NOT EXISTS vendor_contact (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID NOT NULL REFERENCES vendor(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  title VARCHAR(100),
  email VARCHAR(255) NOT NULL,
  phone VARCHAR(50),
  is_primary BOOLEAN DEFAULT false,
  receives_rfq BOOLEAN DEFAULT true,
  -- Linked once the vendor accepts an invite via F8.
  user_id TEXT REFERENCES "user"(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vendor_contact_vendor ON vendor_contact(vendor_id);

-- Enforce at most one primary contact per vendor.
CREATE UNIQUE INDEX IF NOT EXISTS vendor_contact_primary_uk
  ON vendor_contact(vendor_id) WHERE is_primary = true;

CREATE TABLE IF NOT EXISTS vendor_trade (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID NOT NULL REFERENCES vendor(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES element_category(id) ON DELETE CASCADE,
  proficiency_level VARCHAR(20) DEFAULT 'standard'
    CHECK (proficiency_level IN ('standard','specialist','preferred')),
  notes TEXT,
  UNIQUE(vendor_id, category_id)
);

CREATE INDEX IF NOT EXISTS idx_vendor_trade_vendor ON vendor_trade(vendor_id);
CREATE INDEX IF NOT EXISTS idx_vendor_trade_category ON vendor_trade(category_id);

-- Audit infrastructure (introduced in F7, extended by F21).
-- Generic enough to hold any sensitive-action log entry: who, what, on which
-- target, with structured metadata.
CREATE TABLE IF NOT EXISTS audit_event (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id TEXT NOT NULL REFERENCES "organization"(id) ON DELETE CASCADE,
  actor_id TEXT REFERENCES "user"(id) ON DELETE SET NULL,
  action VARCHAR(64) NOT NULL,
  target_table VARCHAR(64) NOT NULL,
  target_id UUID,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_event_org_created
  ON audit_event(org_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_event_target
  ON audit_event(target_table, target_id);
CREATE INDEX IF NOT EXISTS idx_audit_event_actor
  ON audit_event(actor_id, created_at DESC);
