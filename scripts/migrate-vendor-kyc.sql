-- Feature 7.1: Vendor Tax ID + KYC Documents
-- Extends F7 vendor table with compliance fields and adds a document-store
-- table for proof-of-licence uploads (tax certificate, trade licence, ISO,
-- insurance). Status flow: unverified -> pending -> verified | rejected.

BEGIN;

ALTER TABLE vendor
  ADD COLUMN IF NOT EXISTS tax_id VARCHAR(50),
  ADD COLUMN IF NOT EXISTS kyc_status VARCHAR(20) NOT NULL DEFAULT 'unverified'
    CHECK (kyc_status IN ('unverified','pending','verified','rejected')),
  ADD COLUMN IF NOT EXISTS kyc_verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS kyc_verified_by TEXT REFERENCES "user"(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS kyc_notes TEXT;

CREATE TABLE IF NOT EXISTS vendor_kyc_document (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID NOT NULL REFERENCES vendor(id) ON DELETE CASCADE,
  doc_type VARCHAR(40) NOT NULL
    CHECK (doc_type IN ('tax_certificate','trade_licence','iso_certification','insurance','other')),
  file_url TEXT NOT NULL,
  file_name VARCHAR(255) NOT NULL,
  expires_at DATE,
  uploaded_by TEXT REFERENCES "user"(id) ON DELETE SET NULL,
  uploaded_at TIMESTAMPTZ DEFAULT now(),
  notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_vendor_kyc_doc_vendor
  ON vendor_kyc_document(vendor_id);

-- Partial index speeds up "expiring within N days" lookups for the dashboard
-- widget planned in F18; safe to ship now.
CREATE INDEX IF NOT EXISTS idx_vendor_kyc_doc_expiring
  ON vendor_kyc_document(expires_at)
  WHERE expires_at IS NOT NULL;

COMMIT;
