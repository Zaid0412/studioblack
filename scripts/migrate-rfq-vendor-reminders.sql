-- Per-vendor RFQ reminder tracking.
--
-- A daily cron emails vendors that haven't responded to an open RFQ every 3 days
-- (see src/lib/rfqReminders.ts). `last_reminder_at` is the cadence anchor — the
-- job re-sends only once COALESCE(last_reminder_at, invited_at) is >= 3 days old,
-- and stamps it after each attempt so a run doesn't re-send within the window.
-- `reminder_count` is informational (drives the "Nth reminder" wording).

ALTER TABLE rfq_vendor
  ADD COLUMN IF NOT EXISTS last_reminder_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reminder_count   INTEGER NOT NULL DEFAULT 0;
