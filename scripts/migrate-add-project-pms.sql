-- StudioBlack: per-project PM assignments
-- Run: psql $DATABASE_URL -f scripts/migrate-add-project-pms.sql
--
-- Adds `role = 'pm'` rows to project_member so PMs can be assigned per
-- project (mirroring the existing per-project architect model). Org owners
-- are NOT backfilled — `hasProjectAccess` short-circuits true for them and
-- they retain implicit access to every project in their org.
--
-- Idempotent: re-running is a no-op thanks to the unique (project_id, user_id)
-- index on project_member.

BEGIN;

-- Backfill: every org admin gets a PM row on every existing project of
-- their org. Skip projects where the admin is already a project_member
-- (e.g. unlikely-but-legal case where an admin was also added as architect).
INSERT INTO project_member (project_id, user_id, role)
SELECT p.id, m."userId", 'pm'
FROM project p
JOIN member m ON m."organizationId" = p.org_id
WHERE m.role = 'admin'
ON CONFLICT (project_id, user_id) DO NOTHING;

COMMIT;
