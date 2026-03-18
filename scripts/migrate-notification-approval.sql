-- Migration: Create notification and approval tables
-- Run after: migrate-attachment-reviews.sql

-- Notification table
CREATE TABLE IF NOT EXISTS notification (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  type        TEXT NOT NULL,
  title       TEXT NOT NULL,
  description TEXT DEFAULT '',
  project_id  UUID REFERENCES project(id) ON DELETE CASCADE,
  task_id     UUID REFERENCES phase_task(id) ON DELETE CASCADE,
  read        BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notification_user
  ON notification (user_id, read, created_at DESC);

-- Approval table (project-level approval decisions from clients)
CREATE TABLE IF NOT EXISTS approval (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  UUID NOT NULL REFERENCES project(id) ON DELETE CASCADE,
  phase_id    UUID REFERENCES project_phase(id) ON DELETE CASCADE,
  user_id     TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  decision    TEXT NOT NULL CHECK (decision IN ('approved', 'changes_requested')),
  comment     TEXT DEFAULT '',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_approval_project
  ON approval (project_id, created_at DESC);
