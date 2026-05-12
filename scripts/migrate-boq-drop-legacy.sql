-- BOQ per-item lifecycle — drop legacy columns
--
-- PR-2 cutover follow-up to `migrate-boq-item-phase.sql` (PR-1). Removes the
-- old BOQ-wide state machine and the per-item dual-status columns now that
-- the unified `phase` column is the single source of truth.
--
-- ⚠️ Runs AFTER PR-2 code deploys to prod. The previously-deployed PR-1
-- runtime still reads these columns; dropping them before the deploy will
-- 500 every BOQ-related route until the new bundle goes live.
--
-- Idempotent: every drop is guarded by IF EXISTS.
--
-- Run: psql $DATABASE_URL -f scripts/migrate-boq-drop-legacy.sql

BEGIN;

-- 1. boq_item: drop the dual-status columns and the re-approval flag.
ALTER TABLE boq_item
  DROP COLUMN IF EXISTS lifecycle_status,
  DROP COLUMN IF EXISTS client_approval_status,
  DROP COLUMN IF EXISTS client_approved_at,
  DROP COLUMN IF EXISTS client_approved_by,
  DROP COLUMN IF EXISTS requires_reapproval;

-- 2. boq: drop the BOQ-wide state machine + its denormalised audit columns.
--    Full history of who-changed-what still lives in `audit_event`.
ALTER TABLE boq
  DROP COLUMN IF EXISTS status,
  DROP COLUMN IF EXISTS internal_review_submitted_at,
  DROP COLUMN IF EXISTS internal_review_submitted_by,
  DROP COLUMN IF EXISTS internally_approved_at,
  DROP COLUMN IF EXISTS internally_approved_by,
  DROP COLUMN IF EXISTS changes_requested_at,
  DROP COLUMN IF EXISTS changes_requested_by,
  DROP COLUMN IF EXISTS changes_requested_comment;

-- 3. Drop the boq.status CHECK constraint if it survived the column drop.
ALTER TABLE boq DROP CONSTRAINT IF EXISTS boq_status_check;

-- 4. Drop the partial index keyed on the removed client_approval_status.
DROP INDEX IF EXISTS idx_boq_item_pending_approval;

COMMIT;
