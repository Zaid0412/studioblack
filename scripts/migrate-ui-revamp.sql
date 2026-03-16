-- UI Revamp migration — run after migrate.sql
-- Adds workflow steps, file versioning, and review status to attachments.
-- Run: psql $DATABASE_URL -f scripts/migrate-ui-revamp.sql

-- 1. Workflow steps table (7 high-level project stages)
CREATE TABLE IF NOT EXISTS project_step (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES project(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  step_order INT NOT NULL,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(project_id, step_order)
);

-- 2. Link phases to steps
ALTER TABLE project_phase ADD COLUMN IF NOT EXISTS step_id UUID REFERENCES project_step(id) ON DELETE SET NULL;

-- 3. File versioning + review on attachments
ALTER TABLE attachment ADD COLUMN IF NOT EXISTS version INT DEFAULT 1;
ALTER TABLE attachment ADD COLUMN IF NOT EXISTS version_group UUID DEFAULT gen_random_uuid();
ALTER TABLE attachment ADD COLUMN IF NOT EXISTS review_status TEXT DEFAULT 'pending';
ALTER TABLE attachment ADD COLUMN IF NOT EXISTS reviewed_by TEXT REFERENCES "user"(id) ON DELETE SET NULL;
