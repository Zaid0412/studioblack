-- Partial index supporting the "Pending Reviews" surfaces.
--
-- Two queries scan `attachment` for rows with `review_status = 'pending'`:
-- - `getDashboardStats` (count for the dashboard stat card)
-- - `getPendingReviews` (list rendered in the popover)
--
-- Both filter post-join with `project.org_id`. As the attachment table grows,
-- a sequential scan + filter on every dashboard render becomes a hot spot.
-- A partial index on `project_id WHERE review_status = 'pending'` is small
-- (only the rare pending rows) and answers the question directly.
--
-- Run: psql $DATABASE_URL -f scripts/migrate-attachment-pending-index.sql

CREATE INDEX IF NOT EXISTS idx_attachment_pending_review
  ON attachment (project_id)
  WHERE review_status = 'pending';
