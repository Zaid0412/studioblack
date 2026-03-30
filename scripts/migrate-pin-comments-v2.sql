-- Allow unpinned (general) comments
ALTER TABLE pin_comment ALTER COLUMN x_percent DROP NOT NULL;
ALTER TABLE pin_comment ALTER COLUMN y_percent DROP NOT NULL;
ALTER TABLE pin_comment ALTER COLUMN page DROP NOT NULL;

-- Link comment to a task
ALTER TABLE pin_comment ADD COLUMN IF NOT EXISTS task_id UUID REFERENCES task(id) ON DELETE SET NULL;

-- Request for approval flag
ALTER TABLE pin_comment ADD COLUMN IF NOT EXISTS request_approval BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_pin_comment_task ON pin_comment(task_id);
