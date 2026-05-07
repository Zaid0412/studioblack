-- BOQ internal review & approval gate
-- Adds three new statuses (pending_internal_review, internally_approved,
-- changes_requested) plus seven audit columns on `boq`. Existing rows
-- keep their current status — the gate only applies to new submissions
-- and to BOQs that re-enter `draft`.
--
-- Idempotent.
--
-- Run: psql $DATABASE_URL -f scripts/migrate-boq-internal-review.sql

-- 1. Allow the new statuses on `boq.status`.
ALTER TABLE boq DROP CONSTRAINT IF EXISTS boq_status_check;
ALTER TABLE boq ADD CONSTRAINT boq_status_check CHECK (
  status IN (
    'draft',
    'pending_internal_review',
    'internally_approved',
    'changes_requested',
    'submitted_to_client',
    'client_approved',
    'locked',
    'superseded'
  )
);

-- 2. Audit columns for the latest internal-review action.
-- Older actions are still in `audit_event` (full history); these are
-- denormalised onto the row so the UI can render the most recent
-- decision + comment without an extra join.
ALTER TABLE boq
  ADD COLUMN IF NOT EXISTS internal_review_submitted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS internal_review_submitted_by TEXT REFERENCES "user"(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS internally_approved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS internally_approved_by TEXT REFERENCES "user"(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS changes_requested_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS changes_requested_by TEXT REFERENCES "user"(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS changes_requested_comment TEXT;
