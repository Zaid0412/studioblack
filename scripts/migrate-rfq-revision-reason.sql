-- RFQ-3b/3c: persist the reason a PM gives when raising an RFQ revision.
-- Previously the reason was collected in the revise dialog but only written to
-- the audit log; nothing surfaced it. Store it on the revision row so the
-- detail page can show "why this revision exists" next to the supersedes banner.
-- Additive + nullable: originals and pre-existing revisions stay NULL.

ALTER TABLE rfq ADD COLUMN IF NOT EXISTS revision_reason text;
