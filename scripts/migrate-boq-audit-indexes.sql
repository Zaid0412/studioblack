-- BOQ audit + project-member indexes for lifecycle-8 queries
--
-- Backs the new reads added in PR #120:
--   - getLatestBoqItemChangeRequest (src/lib/queries/boq.ts) hits audit_event
--     with action = 'boq.item.phase_changed' and either matches a single
--     boq_item target or uses a JSONB containment check against metadata.item_ids.
--   - getProjectStaffIds (src/lib/queries/boq.ts) hits project_member filtered
--     by project_id + role IN ('pm', 'architect').
--
-- Existing indexes don't cover these:
--   - audit_event has (target_table, target_id), (actor_id, created_at),
--     (organization_id, created_at) — none cover the JSONB containment branch
--     or pair target_id with created_at for the ORDER BY.
--   - project_member has only UNIQUE(project_id, user_id) — role is not indexed.
--
-- Idempotent: uses CREATE INDEX IF NOT EXISTS so re-runs are safe.
--
-- NOTE: CREATE INDEX CONCURRENTLY cannot run inside a transaction block, so
-- this script intentionally does NOT use BEGIN/COMMIT. Each statement is
-- independent and idempotent; partial failure leaves the rest re-runnable.
-- CONCURRENTLY avoids long write locks on potentially-large prod tables.
--
-- Run: psql $DATABASE_URL -f scripts/migrate-boq-audit-indexes.sql

-- 1. GIN index on audit_event.metadata for JSONB containment lookups
--    (covers the `metadata @> jsonb_build_object('item_ids', ...)` branch).
--    jsonb_path_ops is smaller + faster than the default for @> queries.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_event_boq_item_metadata
  ON audit_event
  USING GIN (metadata jsonb_path_ops)
  WHERE action = 'boq.item.phase_changed';

-- 2. Composite index on (target_id, created_at DESC) for the single-item branch
--    of getLatestBoqItemChangeRequest. Partial filter keeps the index tiny.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_event_boq_item_target
  ON audit_event (target_id, created_at DESC)
  WHERE target_table = 'boq_item' AND action = 'boq.item.phase_changed';

-- 3. Composite index on project_member (project_id, role) for getProjectStaffIds.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_project_member_project_role
  ON project_member (project_id, role);
