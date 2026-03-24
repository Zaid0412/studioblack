-- Migration: Add design freeze support to attachment table
-- Purpose: Adds frozen_at column to track when files are frozen during design reviews
-- Allows tracking of which attachments are locked/read-only as part of the design freeze workflow

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'attachment' AND column_name = 'frozen_at'
  ) THEN
    ALTER TABLE attachment ADD COLUMN frozen_at TIMESTAMPTZ DEFAULT NULL;
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_attachment_frozen_at ON attachment(frozen_at);
