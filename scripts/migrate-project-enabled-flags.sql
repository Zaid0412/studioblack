-- Adds a non-destructive visibility flag to project phases and workflow steps.
-- Disabling hides the tab/stepper entry; the underlying data is preserved.
--
-- Run: psql $DATABASE_URL -f scripts/migrate-project-enabled-flags.sql

ALTER TABLE project_phase ADD COLUMN IF NOT EXISTS enabled BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE project_step ADD COLUMN IF NOT EXISTS enabled BOOLEAN NOT NULL DEFAULT true;
