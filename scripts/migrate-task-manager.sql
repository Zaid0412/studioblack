-- Task Manager migration — run after migrate-notification-approval.sql
-- Adds a standalone task table for the org-level task manager.
-- Run: psql $DATABASE_URL -f scripts/migrate-task-manager.sql

CREATE TABLE IF NOT EXISTS task (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      TEXT NOT NULL REFERENCES organization(id) ON DELETE CASCADE,
  project_id  UUID REFERENCES project(id) ON DELETE CASCADE,
  phase_id    UUID REFERENCES project_phase(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  description TEXT DEFAULT '',
  status      TEXT NOT NULL DEFAULT 'todo' CHECK (status IN ('todo', 'in_progress', 'completed', 'archived')),
  priority    TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  category    TEXT NOT NULL DEFAULT 'general' CHECK (category IN ('general', 'design', 'review', 'revision', 'production', 'handover')),
  created_by  TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  assigned_to TEXT REFERENCES "user"(id) ON DELETE SET NULL,
  due_date    DATE,
  reminder_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_task_org ON task (org_id, status);
CREATE INDEX IF NOT EXISTS idx_task_assigned ON task (assigned_to, status);
CREATE INDEX IF NOT EXISTS idx_task_created_by ON task (created_by);
CREATE INDEX IF NOT EXISTS idx_task_project ON task (project_id);
CREATE INDEX IF NOT EXISTS idx_task_due ON task (due_date) WHERE due_date IS NOT NULL AND status != 'completed';
