-- Drop the dead `scope_add` / `scope_remove` BOQ change reasons.
-- They were reserved for the RFQ-3c scope-change flow, which was reverted
-- (#178). No live write path produces them and `deriveChangeReason` can't
-- return them, so they are unreachable enum values. Tighten the CHECK to the
-- three reachable reasons. Fails loudly if any stale row still uses a removed
-- value (there should be none post-revert — verify before applying to prod).

BEGIN;

ALTER TABLE boq_item_version
  DROP CONSTRAINT IF EXISTS boq_item_version_change_reason_check;

ALTER TABLE boq_item_version
  ADD CONSTRAINT boq_item_version_change_reason_check
  CHECK (change_reason IN ('quantity', 'specification', 'other'));

COMMIT;
