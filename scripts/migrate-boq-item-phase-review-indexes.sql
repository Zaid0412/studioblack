-- Partial indexes for the dashboard "pending BOQ review" surfaces.
--
-- Three reads scan `boq_item` by phase, then join up to the org via boq→project:
-- - getDashboardStats  (boq_review_stats CTE: COUNT DISTINCT boq_id in internal_review)
-- - getPendingBoqReviews  (org-wide list of BOQs with items in internal_review)
-- - getClientPendingReviews  (BOQ list + total for sent_to_client / client_reviewing)
--
-- The only phase index is idx_boq_item_phase (boq_id, phase) — boq_id-leading,
-- so an org-wide phase filter has no boq_id to seed from and the planner walks
-- the org's BOQ items. Mirrors scripts/migrate-attachment-pending-index.sql:
-- index the rare pending phases directly on boq_id (the join key up to project).
-- The partial predicate already pins the phase, so boq_id alone suffices.
--
-- Run: psql $DATABASE_URL -f scripts/migrate-boq-item-phase-review-indexes.sql

CREATE INDEX IF NOT EXISTS idx_boq_item_internal_review
  ON boq_item (boq_id)
  WHERE phase = 'internal_review';

CREATE INDEX IF NOT EXISTS idx_boq_item_client_review
  ON boq_item (boq_id)
  WHERE phase IN ('sent_to_client', 'client_reviewing');
