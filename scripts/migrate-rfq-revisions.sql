-- RFQ-3b: RFQ revisions (clone + supersede).
-- A scope change after issue raises a REVISION: a fresh draft RFQ that reuses the
-- base rfq_number (RFQ-2026-0042 · Rev 1) and supersedes the prior one. The old
-- RFQ moves to status 'superseded' (a terminal state that the existing status
-- guards already refuse to mutate). Additive.

BEGIN;

ALTER TABLE rfq
  ADD COLUMN IF NOT EXISTS revision_number INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS supersedes_rfq_id UUID REFERENCES rfq(id) ON DELETE SET NULL;

-- Allow the new terminal status. Without this the status CHECK rejects
-- `UPDATE rfq SET status = 'superseded'` and the whole revise flow fails.
ALTER TABLE rfq DROP CONSTRAINT IF EXISTS rfq_status_check;
ALTER TABLE rfq ADD CONSTRAINT rfq_status_check CHECK (
  status IN ('draft', 'issued', 'quotes_received', 'under_review', 'awarded', 'cancelled', 'superseded')
);

-- The client-facing number is now unique per (org, number, revision) so a
-- revision can share its parent's base number.
ALTER TABLE rfq DROP CONSTRAINT IF EXISTS rfq_org_id_rfq_number_key;
ALTER TABLE rfq
  ADD CONSTRAINT rfq_org_number_revision_key UNIQUE (org_id, rfq_number, revision_number);

-- Look up a revision chain by parent.
CREATE INDEX IF NOT EXISTS idx_rfq_supersedes ON rfq (supersedes_rfq_id);

COMMIT;
