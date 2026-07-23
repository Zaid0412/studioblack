-- Design → Document Control, PDS v2.0 catch-up: Representation + Location, and
-- enum reconciles to the 2026-07-22 revision.
--
-- Additive + data-only (mirrors the BOQ / earlier Document-Control arc):
--   * two new nullable classification columns on `drawing`
--   * discipline default codes reconciled in-place (names unchanged; sort_order
--     preserved; custom rows untouched)
--   * `drawing_revision.issue_purpose` CHECK widened to the PDS 8 (drop the
--     unused `for_review`)
--
-- Verified safe against dev + prod before writing: no numbered drawing embeds a
-- renamed discipline code, and no `drawing_revision` uses `for_review`. The
-- drawing_type set (10 → 13) has no DB CHECK, so it's a code-only change.
--
-- Idempotent: re-runnable (ADD COLUMN IF NOT EXISTS; the discipline UPDATE only
-- matches old codes; the CHECK is dropped-if-exists then recreated).

BEGIN;

-- ─── New drawing classification metadata (PDS v2.0 §4D, §2) ──────────────────
-- Representation is how the design is presented (never in the document number);
-- Location is an optional spatial reference used for filtering only.
ALTER TABLE drawing ADD COLUMN IF NOT EXISTS representation VARCHAR(10)
  CHECK (representation IN ('2D', '3D', 'REN', 'VR'));
ALTER TABLE drawing ADD COLUMN IF NOT EXISTS location VARCHAR(120);

-- ─── Discipline code reconcile (PDS v2.0 §4B) ───────────────────────────────
-- Rename the 6 default codes in place, keyed on the old code. Names are
-- identical before/after, so only `code` changes; sort_order and any
-- company-custom disciplines are left alone. The unique (org_id, lower(code))
-- index can't collide — the new codes were never seeded before.
UPDATE design_discipline AS d
   SET code = m.new_code, updated_at = now()
  FROM (VALUES
    ('EL', 'ELC'),
    ('PL', 'PLB'),
    ('ME', 'MEC'),
    ('LS', 'LND'),
    ('FF', 'FUR'),
    ('3D', 'VIS')
  ) AS m(old_code, new_code)
 WHERE lower(d.code) = lower(m.old_code);

-- ─── Issue-purpose CHECK widen to the PDS 8 (drop unused `for_review`) ───────
ALTER TABLE drawing_revision
  DROP CONSTRAINT IF EXISTS drawing_revision_issue_purpose_check;
ALTER TABLE drawing_revision
  ADD CONSTRAINT drawing_revision_issue_purpose_check
  CHECK (issue_purpose IN ('internal_review', 'client_review', 'for_approval',
    'for_tender', 'for_construction', 'as_built', 'record_copy',
    'for_information'));

COMMIT;
