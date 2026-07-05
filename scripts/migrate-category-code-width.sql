-- Shared taxonomy (PR 1): widen element_category.code_prefix
--
-- The unified taxonomy uses full path codes at each level — Category `KIT`,
-- Sub-category `KIT-CAB`, Service Area `KIT-CAB-BASE` (up to ~14 chars). The
-- original VARCHAR(10) only fit the top-level prefix.
--
-- Run: psql $DATABASE_URL -f scripts/migrate-category-code-width.sql

BEGIN;

ALTER TABLE element_category
  ALTER COLUMN code_prefix TYPE VARCHAR(20);

COMMIT;
