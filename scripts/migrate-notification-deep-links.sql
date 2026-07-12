-- Notification deep-links: give a notification enough context to open the thing
-- it is about.
--
-- Until now the row carried only project_id (+ an unused task_id), so every
-- non-BOQ notification could only route to the project, which redirects to
-- /designs. RFQ, design-review and task notifications had nowhere to store the
-- id of their target.
--
-- task_id previously referenced phase_task -- the table /tasks/{id} does NOT
-- serve. It is NULL in every row of both prod and dev (0 of 234), so it has
-- never carried data and is safe to repoint at `task`. phase_task gets no
-- column of its own: it has no page to deep-link to (it surfaces only on the
-- project's designs tab, which is where the project destination already lands),
-- so storing its id would buy nothing.
--
-- ON DELETE SET NULL, not CASCADE: deleting the target should degrade the
-- notification's link (destination falls back to the project, or becomes
-- non-clickable), not delete the user's notification history. project_id keeps
-- CASCADE -- a deleted project's notifications are meaningless.

ALTER TABLE notification DROP CONSTRAINT IF EXISTS notification_task_id_fkey;
ALTER TABLE notification
  ADD CONSTRAINT notification_task_id_fkey
    FOREIGN KEY (task_id) REFERENCES task(id) ON DELETE SET NULL;

ALTER TABLE notification
  ADD COLUMN IF NOT EXISTS rfq_id        UUID REFERENCES rfq(id)        ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS attachment_id UUID REFERENCES attachment(id) ON DELETE SET NULL;

-- An ON DELETE SET NULL foreign key with no index on the child column makes
-- Postgres seq-scan `notification` once per deleted parent row. Partial, since
-- these columns are overwhelmingly NULL -- near-zero size and write cost.
CREATE INDEX IF NOT EXISTS idx_notification_task
  ON notification (task_id) WHERE task_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_notification_rfq
  ON notification (rfq_id) WHERE rfq_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_notification_attachment
  ON notification (attachment_id) WHERE attachment_id IS NOT NULL;
