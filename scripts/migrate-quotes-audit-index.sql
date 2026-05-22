-- F10 follow-up: index for the audit-event JSONB join used by getRfqEvents.
--
-- F10 added quote.* events that link back to an RFQ via metadata.rfq_id
-- (rather than target_id, because target_id points at the vendor_quote
-- row). The timeline read query joins via `metadata->>'rfq_id'` which
-- can't use the existing (target_table, target_id) index. This partial
-- expression index covers exactly that lookup path.

CREATE INDEX IF NOT EXISTS idx_audit_event_quote_rfq_id
  ON audit_event ((metadata->>'rfq_id'))
  WHERE target_table = 'vendor_quote';
