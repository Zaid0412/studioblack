-- Design → Document Control Module, PR-3: Revisions & issue + 3-state markup.
--
-- A "revision" is an official issue of a drawing at a specific version — a
-- snapshot of one `attachment` row (Rev-00, Rev-01, …) with an issue purpose.
-- It's append-only, so previous revisions are read-only by construction; the
-- drawing can still take new versions for the next revision (revision read-only
-- is NOT the whole-drawing design freeze — that stays `attachment.frozen_at`).
--
-- Also promotes pin-comment markup from a `resolved` boolean to a 3-state
-- Open/Resolved/Closed `status`, backfilled from `resolved`. `resolved` is kept
-- in sync for now; dropping it is deferred.
--
-- Additive + nullable-first (mirrors the BOQ / PR-2 arc). Lifecycle enforcement
-- (12-state drawing transitions) lands in PR-4.

BEGIN;

-- ─── Official revisions ─────────────────────────────────────────────────────
-- One row per issue. rev_number restarts per drawing (Rev-00 = MAX+1 of none).
-- attachment_id pins the exact version snapshotted; issued_by/at is the record.
CREATE TABLE IF NOT EXISTS drawing_revision (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  drawing_id UUID NOT NULL REFERENCES drawing(id) ON DELETE CASCADE,
  org_id TEXT NOT NULL REFERENCES "organization"(id) ON DELETE CASCADE,
  rev_number INT NOT NULL,
  attachment_id UUID NOT NULL REFERENCES attachment(id) ON DELETE CASCADE,
  issue_purpose VARCHAR(30) NOT NULL
    CHECK (issue_purpose IN ('for_review', 'for_approval', 'for_information',
      'for_construction', 'as_built')),
  issued_by TEXT NOT NULL REFERENCES "user"(id),
  issued_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (drawing_id, rev_number)
);

CREATE INDEX IF NOT EXISTS idx_drawing_revision_drawing
  ON drawing_revision(drawing_id);
CREATE INDEX IF NOT EXISTS idx_drawing_revision_attachment
  ON drawing_revision(attachment_id);

-- The drawing's latest issued revision (null until first issue). Nullable FK —
-- a drawing may never be issued.
ALTER TABLE drawing ADD COLUMN IF NOT EXISTS current_revision_id UUID
  REFERENCES drawing_revision(id) ON DELETE SET NULL;

-- ─── Markup: resolved boolean → Open/Resolved/Closed status ──────────────────
ALTER TABLE pin_comment ADD COLUMN IF NOT EXISTS status VARCHAR(10)
  NOT NULL DEFAULT 'open'
  CHECK (status IN ('open', 'resolved', 'closed'));

-- Backfill from the existing boolean. `resolved` stays and is kept in sync by
-- the app until a later PR drops it.
UPDATE pin_comment
   SET status = CASE WHEN resolved THEN 'resolved' ELSE 'open' END
 WHERE status = 'open';

COMMIT;
