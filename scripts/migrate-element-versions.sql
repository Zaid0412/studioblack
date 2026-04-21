-- Feature 3: Element versioning
-- Adds version_group + version_number so an element can have multiple versions
-- that share a code. The highest version_number in a group is the current one.
--
-- Legacy rows imported with the old "-v2" suffix strategy stay as independent
-- elements — no auto-linking heuristics run here.

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
