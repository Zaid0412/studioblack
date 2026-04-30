-- Feature 7.5: Rate Contracts
-- Vendor-scoped, time-bound element pricing. Lets architects pre-negotiate
-- rates with vendors and import them straight into a BOQ without going
-- through the RFQ → quote loop. Activates the `source = 'rate_contract'`
-- value reserved in F6.1.

BEGIN;

CREATE TABLE IF NOT EXISTS rate_contract (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id TEXT NOT NULL REFERENCES "organization"(id) ON DELETE CASCADE,
  vendor_id UUID NOT NULL REFERENCES vendor(id) ON DELETE RESTRICT,
  contract_number VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','active','expired','cancelled')),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  agreement_signed_date DATE,
  currency VARCHAR(3) DEFAULT 'USD',
  payment_terms VARCHAR(100),
  agreement_url TEXT,
  terms_and_conditions TEXT,
  notes TEXT,
  created_by TEXT REFERENCES "user"(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT chk_rate_contract_dates CHECK (end_date >= start_date)
);

CREATE TABLE IF NOT EXISTS rate_contract_item (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rate_contract_id UUID NOT NULL REFERENCES rate_contract(id) ON DELETE CASCADE,
  element_id UUID NOT NULL REFERENCES element(id) ON DELETE CASCADE,
  unit VARCHAR(30) NOT NULL,
  rate NUMERIC(12,2) NOT NULL,
  notes TEXT,
  UNIQUE (rate_contract_id, element_id)
);

CREATE INDEX IF NOT EXISTS idx_rate_contract_org ON rate_contract(org_id);
CREATE INDEX IF NOT EXISTS idx_rate_contract_vendor ON rate_contract(vendor_id);
CREATE INDEX IF NOT EXISTS idx_rate_contract_active
  ON rate_contract(org_id, status)
  WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_rate_contract_item_contract
  ON rate_contract_item(rate_contract_id);
CREATE INDEX IF NOT EXISTS idx_rate_contract_item_element
  ON rate_contract_item(element_id);

-- Bind boq_item rows back to the rate-contract item that priced them.
-- ON DELETE SET NULL so contract deletion preserves the BOQ item but breaks
-- the link (the item becomes a frozen-rate snapshot).
ALTER TABLE boq_item
  ADD COLUMN IF NOT EXISTS rate_contract_item_id UUID
    REFERENCES rate_contract_item(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_boq_item_rate_contract_item
  ON boq_item(rate_contract_item_id) WHERE rate_contract_item_id IS NOT NULL;

COMMIT;
