-- Feature 3: Element versioning
-- Adds version_group + version_number so an element can have multiple versions
-- that share a code. The highest version_number in a group is the current one.
--
-- Legacy rows imported with the old "-v2" suffix strategy stay as independent
-- elements — no auto-linking heuristics run here.
--
-- ⚠️  WARNING for large / high-traffic deployments (>1M rows):
-- `DEFAULT gen_random_uuid()` is VOLATILE, so step 1 rewrites every heap row
-- under AccessExclusiveLock. `ADD CONSTRAINT UNIQUE` in step 3 builds its
-- index under exclusive lock too. On a big table, replay this as four steps
-- instead:
--   1) ALTER TABLE element ADD COLUMN version_group UUID, ADD COLUMN version_number INTEGER;
--   2) UPDATE element SET version_group = gen_random_uuid(), version_number = 1
--        WHERE version_group IS NULL;  -- batch in chunks of ~1000
--   3) ALTER TABLE element ALTER COLUMN version_group SET NOT NULL,
--        ALTER COLUMN version_number SET NOT NULL;
--   4) CREATE UNIQUE INDEX CONCURRENTLY idx_uq_element_org_version
--        ON element(org_id, version_group, version_number);
--      ALTER TABLE element ADD CONSTRAINT uq_element_org_version
--        UNIQUE USING INDEX idx_uq_element_org_version;
--
-- This file is left as-is for reproducibility on fresh/small databases.

BEGIN;

-- 1. Add columns. gen_random_uuid() default fills each existing row with its
--    own group so every current element becomes version 1 of itself.
ALTER TABLE element
  ADD COLUMN IF NOT EXISTS version_group UUID NOT NULL DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS version_number INTEGER NOT NULL DEFAULT 1;

-- 2. Drop the old (org_id, code) unique constraint — two versions can now
--    share a code within a group.
ALTER TABLE element
  DROP CONSTRAINT IF EXISTS uq_element_org_code;

-- 3. New uniqueness: one row per (org, group, version).
ALTER TABLE element
  ADD CONSTRAINT uq_element_org_version
  UNIQUE (org_id, version_group, version_number);

-- 4. Lookup index for version history queries.
CREATE INDEX IF NOT EXISTS idx_element_version_group
  ON element(version_group);

-- Note: code uniqueness across groups is now enforced at the application
-- level inside bulkUpsertElements / element POST handlers. A DB-level
-- partial index would either block legitimate new versions from being
-- inserted or require synchronising is_active with version status —
-- both messier than a single SELECT inside an orgId-scoped transaction.

COMMIT;
