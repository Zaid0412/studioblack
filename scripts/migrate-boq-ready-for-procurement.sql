-- RFQ-4a: BOQ "Ready for Procurement" phase (RFQ eligibility gate).
-- A client-approved item is moved to `ready_for_procurement` by the PM; only
-- items in that phase can enter an RFQ. Additive: just widen the phase CHECK
-- (adding a value without this fails the constraint).

BEGIN;

ALTER TABLE boq_item DROP CONSTRAINT IF EXISTS boq_item_phase_check;
ALTER TABLE boq_item ADD CONSTRAINT boq_item_phase_check CHECK (
  phase IN (
    'draft', 'internal_review', 'internal_changes_requested',
    'internally_approved', 'sent_to_client', 'client_reviewing',
    'client_changes_requested', 'client_approved', 'ready_for_procurement'
  )
);

COMMIT;
