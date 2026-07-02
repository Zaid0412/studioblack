-- RFQ-1: manual / multi-channel quote entry + evidence.
-- Lets a PM record a quote received off-channel (email/WhatsApp/phone/…),
-- tag how it arrived, and how the RFQ was distributed. Additive; existing
-- portal quotes backfill to response_source='portal'.

BEGIN;

-- How a quote arrived + who keyed it (entered_by null = vendor-submitted).
ALTER TABLE vendor_quote
  ADD COLUMN IF NOT EXISTS response_source TEXT NOT NULL DEFAULT 'portal'
    CHECK (response_source IN (
      'portal', 'email', 'whatsapp', 'phone', 'pdf', 'excel', 'manual'
    )),
  ADD COLUMN IF NOT EXISTS received_date DATE,
  ADD COLUMN IF NOT EXISTS entered_by TEXT;

-- How the RFQ was sent to each vendor.
ALTER TABLE rfq_vendor
  ADD COLUMN IF NOT EXISTS distribution_method TEXT
    CHECK (distribution_method IN ('portal', 'email', 'whatsapp', 'manual')),
  ADD COLUMN IF NOT EXISTS sent_date TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS sent_by TEXT;

COMMIT;
