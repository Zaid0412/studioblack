-- Attachment reviews migration — run after migrate-ui-revamp.sql
-- Adds per-file review history (supports multiple review rounds like GitHub PR reviews).
-- Run: psql $DATABASE_URL -f scripts/migrate-attachment-reviews.sql

CREATE TABLE IF NOT EXISTS attachment_review (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attachment_id UUID NOT NULL REFERENCES attachment(id) ON DELETE CASCADE,
  reviewer_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('approved', 'rejected')),
  comment TEXT DEFAULT '',
  annotated_file_url TEXT,
  annotation_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_attachment_review_attachment
  ON attachment_review(attachment_id);
CREATE INDEX IF NOT EXISTS idx_attachment_review_created
  ON attachment_review(attachment_id, created_at DESC);
