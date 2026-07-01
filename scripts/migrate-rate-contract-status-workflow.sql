-- PR C: rate-contract status workflow + approval.
-- Expands the 4-state status into an 8-state lifecycle and adds approval
-- metadata. Existing rows are unaffected: draft/active/expired/cancelled all
-- remain valid values. Additive — no backfill.

BEGIN;

-- Widen the status CHECK to the full lifecycle.
ALTER TABLE rate_contract DROP CONSTRAINT IF EXISTS rate_contract_status_check;
ALTER TABLE rate_contract
  ADD CONSTRAINT rate_contract_status_check
  CHECK (status IN (
    'draft',
    'under_review',
    'approved',
    'active',
    'suspended',
    'expired',
    'closed',
    'cancelled'
  ));

-- Approval metadata (approved_by mirrors created_by: plain text user id, no FK).
-- review_note carries the reviewer's message when an action requests changes.
ALTER TABLE rate_contract
  ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS approved_by TEXT,
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS review_note TEXT;

COMMIT;
