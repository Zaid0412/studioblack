-- Backfill / fix-up for project_document_section.icon and add the per-project
-- unique-name constraint. Apply this AFTER `migrate-project-documents.sql`
-- on any environment where the original migration already shipped with the
-- lowercase `'folder'` default and no UNIQUE constraint (i.e. anything
-- migrated before this fix landed).
--
-- Run once per environment:
--   psql "$DATABASE_URL" -f scripts/migrate-project-documents-pascal-icons.sql

-- 1. Update the column default to PascalCase so any future row inserted
--    without an explicit icon stays valid by the app's icon regex.
ALTER TABLE project_document_section
  ALTER COLUMN icon SET DEFAULT 'Folder';

-- 2. Convert any pre-existing lowercase / kebab-case icons in the seed set
--    to their PascalCase equivalents. Idempotent: only rows starting with a
--    lowercase letter are touched.
UPDATE project_document_section SET icon = CASE icon
  WHEN 'folder' THEN 'Folder'
  WHEN 'shield-check' THEN 'ShieldCheck'
  WHEN 'file-text' THEN 'FileText'
  WHEN 'receipt' THEN 'Receipt'
  WHEN 'clipboard-list' THEN 'ClipboardList'
  WHEN 'file-pen-line' THEN 'FilePenLine'
  WHEN 'image' THEN 'Image'
  WHEN 'hammer' THEN 'Hammer'
  WHEN 'briefcase' THEN 'Briefcase'
  WHEN 'calculator' THEN 'Calculator'
  WHEN 'building-2' THEN 'Building2'
  WHEN 'scroll-text' THEN 'ScrollText'
  ELSE icon
END
WHERE icon ~ '^[a-z]';

-- 3. Add the per-project unique-name constraint. If any duplicates exist
--    this will fail loudly — that's intentional; the caller should
--    deduplicate manually before re-running.
ALTER TABLE project_document_section
  ADD CONSTRAINT project_document_section_unique_name
  UNIQUE (project_id, name);
