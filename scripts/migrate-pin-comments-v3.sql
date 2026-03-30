-- Pin comments v3: reply threads + edit tracking
-- Run: psql $DATABASE_URL -f scripts/migrate-pin-comments-v3.sql

-- Reply threads: self-referencing parent_id
ALTER TABLE pin_comment ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES pin_comment(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_pin_comment_parent ON pin_comment(parent_id);

-- Edit tracking
ALTER TABLE pin_comment ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;
