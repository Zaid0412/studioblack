-- BOQ lifecycle: expand from 6 phases to 8
--
-- Renames + adds:
--   submitted_to_client → sent_to_client          (label-only)
--   change_requested    → internal_changes_requested
--   + client_reviewing            (auto-set when a client first opens the BOQ)
--   + client_changes_requested    (client-initiated kick-back, separate from internal)
--
-- Idempotent: re-running is safe — the UPDATEs are filtered to old values and
-- the CHECK constraint is dropped before re-adding.
--
-- Run: psql $DATABASE_URL -f scripts/migrate-boq-lifecycle-8.sql

BEGIN;

-- 1. Drop the old CHECK so we can rewrite values without violating it.
ALTER TABLE boq_item DROP CONSTRAINT IF EXISTS boq_item_phase_check;

-- 2. Rewrite existing values.
UPDATE boq_item
SET phase = 'sent_to_client'
WHERE phase = 'submitted_to_client';

UPDATE boq_item
SET phase = 'internal_changes_requested'
WHERE phase = 'change_requested';

-- 3. Rewrite audit-event metadata so the timeline keeps reading correctly.
-- `metadata->>'from_phase'` and `metadata->>'to_phase'` carry the old values
-- on past transition events; rewrite them in place.
UPDATE audit_event
SET metadata = jsonb_set(
  metadata,
  '{from_phase}',
  to_jsonb(
    CASE metadata->>'from_phase'
      WHEN 'submitted_to_client' THEN 'sent_to_client'
      WHEN 'change_requested'    THEN 'internal_changes_requested'
    END
  )
)
WHERE target_table = 'boq_item'
  AND metadata->>'from_phase' IN ('submitted_to_client', 'change_requested');

UPDATE audit_event
SET metadata = jsonb_set(
  metadata,
  '{to_phase}',
  to_jsonb(
    CASE metadata->>'to_phase'
      WHEN 'submitted_to_client' THEN 'sent_to_client'
      WHEN 'change_requested'    THEN 'internal_changes_requested'
    END
  )
)
WHERE target_table = 'boq_item'
  AND metadata->>'to_phase' IN ('submitted_to_client', 'change_requested');

-- 4. Re-add the CHECK with the 8 new values.
ALTER TABLE boq_item ADD CONSTRAINT boq_item_phase_check CHECK (
  phase IN (
    'draft',
    'internal_review',
    'internal_changes_requested',
    'internally_approved',
    'sent_to_client',
    'client_reviewing',
    'client_changes_requested',
    'client_approved'
  )
);

COMMIT;
