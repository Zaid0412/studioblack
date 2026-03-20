-- Migration: Add design freeze support to attachment table
-- Purpose: Adds frozen_at column to track when files are frozen during design reviews
-- Allows tracking of which attachments are locked/read-only as part of the design freeze workflow

ALTER TABLE attachment
ADD COLUMN frozen_at TIMESTAMPTZ DEFAULT NULL;

CREATE INDEX idx_attachment_frozen_at ON attachment(frozen_at);
