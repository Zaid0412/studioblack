-- Feature 10: Vendor Quotes (DB)
-- Vendors submit itemised quotes against RFQs from F9. One quote row per
-- (rfq, vendor) — revisions overwrite the existing row while
-- vendor_quote.status = 'submitted'. Once a quote moves to under_review,
-- awarded, rejected, or expired, it is locked.
--
-- `is_late` is computed at submit time from rfq.response_deadline.
-- `valid_until` is enforced lazily via a check-on-read UPDATE in
-- getQuotesByRfq (no cron).
--
-- The FK on rfq_item.awarded_quote_item_id is added here because the
-- target table (vendor_quote_item) only exists from this migration onward.
-- F9 created the column without a constraint.

CREATE TABLE IF NOT EXISTS vendor_quote (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rfq_id UUID NOT NULL REFERENCES rfq(id) ON DELETE CASCADE,
  vendor_id UUID NOT NULL REFERENCES vendor(id) ON DELETE CASCADE,
  status VARCHAR(20) NOT NULL DEFAULT 'submitted'
    CHECK (status IN ('submitted','under_review','awarded','rejected','expired')),
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  valid_until DATE,
  -- Currency placeholder; multi-currency support deferred (see F4.5 notes).
  currency VARCHAR(3) NOT NULL DEFAULT 'USD',
  delivery_period VARCHAR(100),
  payment_terms VARCHAR(100),
  inclusions TEXT,
  exclusions TEXT,
  notes TEXT,
  -- Reserved for file references; no UI in F10.
  attachments JSONB,
  -- True if submitted after rfq.response_deadline (computed at submit).
  is_late BOOLEAN NOT NULL DEFAULT false,
  awarded_at TIMESTAMPTZ,
  awarded_by TEXT REFERENCES "user"(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- One quote per vendor per RFQ. Revisions PATCH the same row while
  -- status='submitted'.
  CONSTRAINT vendor_quote_unique_per_rfq_vendor UNIQUE (rfq_id, vendor_id)
);

CREATE TABLE IF NOT EXISTS vendor_quote_item (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id UUID NOT NULL REFERENCES vendor_quote(id) ON DELETE CASCADE,
  rfq_item_id UUID NOT NULL REFERENCES rfq_item(id) ON DELETE CASCADE,
  unit_price NUMERIC(12,2) NOT NULL CHECK (unit_price >= 0),
  notes TEXT,
  alternative_spec TEXT,
  CONSTRAINT vendor_quote_item_unique_per_quote_rfq_item UNIQUE (quote_id, rfq_item_id)
);

CREATE INDEX IF NOT EXISTS idx_quote_rfq ON vendor_quote(rfq_id);
CREATE INDEX IF NOT EXISTS idx_quote_vendor ON vendor_quote(vendor_id);
CREATE INDEX IF NOT EXISTS idx_quote_rfq_status ON vendor_quote(rfq_id, status);
CREATE INDEX IF NOT EXISTS idx_quote_item_quote ON vendor_quote_item(quote_id);
CREATE INDEX IF NOT EXISTS idx_quote_item_rfq_item ON vendor_quote_item(rfq_item_id);

-- F9 reserved the column; the FK target now exists.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'rfq_item_awarded_quote_item_fk'
  ) THEN
    ALTER TABLE rfq_item
      ADD CONSTRAINT rfq_item_awarded_quote_item_fk
      FOREIGN KEY (awarded_quote_item_id) REFERENCES vendor_quote_item(id) ON DELETE SET NULL;
  END IF;
END $$;
