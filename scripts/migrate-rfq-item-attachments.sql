-- RFQ PRD §11: per-line RFQ attachments (spec drawings, reference docs).
-- Mirrors the vendor-quote evidence pattern: a JSONB array of {url, fileName}.
ALTER TABLE rfq_item
  ADD COLUMN IF NOT EXISTS attachments jsonb NOT NULL DEFAULT '[]'::jsonb;
