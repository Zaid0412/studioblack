-- RFQ PRD §9: RFQ "Package Type" (Material / Labor / Mixed). Additive + nullable.
ALTER TABLE rfq ADD COLUMN IF NOT EXISTS package_type text
  CHECK (package_type IN ('material', 'labor', 'mixed'));
