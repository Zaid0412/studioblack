-- Down-migration for scripts/migrate-scope-changes.sql (reverting PR #177).
-- Drops the scope_change table and removes the terminal `cancelled` BOQ phase.
--
-- ⚠️ DESTRUCTIVE. Run the SAFETY CHECK first: removing `cancelled` from the
-- phase CHECK fails if any boq_item is currently in that phase. If the check
-- returns any rows, decide where those items should go before proceeding.
--
-- Run once per environment (dev, then prod), inside a transaction.

-- ── SAFETY CHECK (run on its own; must return 0 rows) ──────────────────────
-- SELECT id, boq_id, item_code, phase FROM boq_item WHERE phase = 'cancelled';

BEGIN;

DROP TABLE IF EXISTS scope_change;

-- Restore the pre-PR#177 phase CHECK (drops `cancelled`). Fails loudly if any
-- row still holds `cancelled` — that's intentional; do not force it.
ALTER TABLE boq_item DROP CONSTRAINT IF EXISTS boq_item_phase_check;
ALTER TABLE boq_item ADD CONSTRAINT boq_item_phase_check CHECK (
  phase IN (
    'draft','internal_review','internal_changes_requested','internally_approved',
    'sent_to_client','client_reviewing','client_changes_requested','client_approved',
    'ready_for_procurement'
  )
);

COMMIT;
