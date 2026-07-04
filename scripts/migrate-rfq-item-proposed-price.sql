-- RFQ PRD §11: snapshot the BOQ line's proposed (sell) price onto the RFQ item
-- at creation, as a stable reference to compare vendor quotes against.
ALTER TABLE rfq_item ADD COLUMN IF NOT EXISTS proposed_price numeric;
