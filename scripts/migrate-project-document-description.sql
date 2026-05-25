-- Add an optional description (notes / context) to each project document.
-- Nullable so existing rows stay valid; the upload dialog treats it as
-- optional and the detail sheet renders nothing when it's missing.
--
-- Run once per environment:
--   psql "$DATABASE_URL" -f scripts/migrate-project-document-description.sql

ALTER TABLE project_document
  ADD COLUMN IF NOT EXISTS description text;
