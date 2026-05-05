-- Task comments: GH-style threaded comments on standalone tasks
-- Run: psql $DATABASE_URL -f scripts/migrate-task-comments.sql

CREATE TABLE IF NOT EXISTS task_comment (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organization(id) ON DELETE CASCADE,
  task_id UUID NOT NULL REFERENCES task(id) ON DELETE CASCADE,
  author_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  attachments JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_task_comment_task ON task_comment(task_id, created_at);
CREATE INDEX IF NOT EXISTS idx_task_comment_org ON task_comment(org_id);
CREATE INDEX IF NOT EXISTS idx_task_comment_author ON task_comment(author_id);
