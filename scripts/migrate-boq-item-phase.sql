-- BOQ per-item lifecycle phase
--
-- Adds a single `phase` column on `boq_item` representing the item's current
-- position in the unified lifecycle requested by Pap (2026-05-12):
--
--   draft → internal_review → internally_approved → submitted_to_client →
--     client_approved
--   change_requested  (cycles back to draft)
--
-- Backfilled from the existing `lifecycle_status` + `client_approval_status`
-- + `boq.status` columns. Those columns stay in place during PR-1 — PR-2
-- drops them after the UI cutover.
--
-- Idempotent: the backfill only runs for rows where `phase IS NULL`. Once
-- the new API writes a phase value, re-running the migration won't clobber.
--
-- Run: psql $DATABASE_URL -f scripts/migrate-boq-item-phase.sql

BEGIN;

-- 1. Add column (nullable, so we can detect un-backfilled rows).
ALTER TABLE boq_item
  ADD COLUMN IF NOT EXISTS phase VARCHAR(30),
  ADD COLUMN IF NOT EXISTS sent_to_client_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS client_decided_at TIMESTAMPTZ;

-- 2. Backfill — derive phase from the existing two-column state.
--
-- Priority (later WHEN wins): the strongest "this happened" signal beats
-- weaker ones. A client decision overrides anything internal.
UPDATE boq_item bi
SET
  phase = CASE
    WHEN bi.client_approval_status = 'approved' THEN 'client_approved'
    WHEN bi.lifecycle_status = 'locked' THEN 'client_approved'
    WHEN bi.client_approval_status IN ('rejected', 'queried') THEN 'change_requested'
    WHEN bi.lifecycle_status IN ('rejected', 'queried', 'superseded', 'change_order_pending') THEN 'change_requested'
    WHEN bi.lifecycle_status = 'approved'
         AND EXISTS (
           SELECT 1 FROM boq b
           WHERE b.id = bi.boq_id
             AND b.status IN ('submitted_to_client', 'client_approved')
         )
      THEN 'submitted_to_client'
    WHEN bi.lifecycle_status = 'approved' THEN 'internally_approved'
    WHEN bi.lifecycle_status = 'submitted' THEN 'internal_review'
    ELSE 'draft'
  END,
  client_decided_at = CASE
    WHEN bi.client_approval_status IN ('approved', 'rejected', 'queried')
      THEN bi.client_approved_at
    ELSE NULL
  END,
  sent_to_client_at = CASE
    WHEN bi.client_approval_status = 'approved'
      THEN bi.client_approved_at
    WHEN bi.lifecycle_status = 'approved'
         AND EXISTS (
           SELECT 1 FROM boq b
           WHERE b.id = bi.boq_id
             AND b.status IN ('submitted_to_client', 'client_approved')
         )
      THEN bi.updated_at
    ELSE NULL
  END
WHERE bi.phase IS NULL;

-- 3. Tighten: default + NOT NULL + CHECK constraint.
ALTER TABLE boq_item ALTER COLUMN phase SET DEFAULT 'draft';
ALTER TABLE boq_item ALTER COLUMN phase SET NOT NULL;

ALTER TABLE boq_item DROP CONSTRAINT IF EXISTS boq_item_phase_check;
ALTER TABLE boq_item ADD CONSTRAINT boq_item_phase_check CHECK (
  phase IN (
    'draft',
    'internal_review',
    'internally_approved',
    'submitted_to_client',
    'client_approved',
    'change_requested'
  )
);

-- 4. Index for the dashboard rollup ("X items in internal_review across this project").
CREATE INDEX IF NOT EXISTS idx_boq_item_phase ON boq_item(boq_id, phase);

COMMIT;
