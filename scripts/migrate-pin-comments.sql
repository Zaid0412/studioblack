CREATE TABLE IF NOT EXISTS pin_comment (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attachment_id UUID NOT NULL REFERENCES attachment(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  x_percent DOUBLE PRECISION NOT NULL,
  y_percent DOUBLE PRECISION NOT NULL,
  page INTEGER NOT NULL DEFAULT 1,
  content TEXT NOT NULL,
  resolved BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pin_comment_attachment ON pin_comment(attachment_id);
CREATE INDEX IF NOT EXISTS idx_pin_comment_attachment_page ON pin_comment(attachment_id, page);
