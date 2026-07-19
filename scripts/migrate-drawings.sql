-- Design → Document Control Module, PR-2: Drawing register + numbering.
--
-- A "drawing" is the register header over an existing design-file lineage: one
-- row per attachment `version_group`, carrying the discipline / drawing type /
-- document number. The existing `attachment` rows stay the versions — the
-- viewer, markup, review, and freeze engine are untouched (they key on
-- attachment_id / version_group).
--
-- Additive + nullable-first (mirrors the BOQ arc): new uploads are classified
-- and numbered; existing files are backfilled as UNCLASSIFIED drawings (null
-- discipline/type/document_number) and get classified later. The phases→packages
-- grouping cutover + NOT NULL enforcement land in PR-5.

BEGIN;

-- The drawing document number (`P2026-001-HVAC-PLAN-001`, ~22 chars) is built by
-- nextDrawingNumber() from a `${projectNumber}-${discipline}-${type}` counter
-- prefix, which can exceed the old 20-char ceiling. Widen it.
ALTER TABLE sequence_counter ALTER COLUMN prefix TYPE VARCHAR(40);

CREATE TABLE IF NOT EXISTS drawing (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES project(id) ON DELETE CASCADE,
  org_id TEXT NOT NULL REFERENCES "organization"(id) ON DELETE CASCADE,
  -- One drawing per file lineage. version_group is globally unique (uuid), so it
  -- alone identifies the group `attachment` rows join back on.
  version_group UUID NOT NULL UNIQUE,
  -- Classification (null until set — required on new uploads, backfilled null on
  -- legacy). package_id waits for the PR-5 grouping cutover.
  package_id UUID REFERENCES design_package(id) ON DELETE SET NULL,
  discipline_id UUID REFERENCES design_discipline(id) ON DELETE SET NULL,
  drawing_type VARCHAR(10),
  document_number VARCHAR(60),
  title VARCHAR(255),
  -- 12-state drawing lifecycle. CHECK is the data-integrity floor; the
  -- declarative transition machine lands in PR-4.
  status VARCHAR(30) NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'submitted', 'internal_review',
      'internal_approved', 'sent_to_client', 'client_review',
      'changes_requested', 'revised', 'resubmitted', 'client_approved',
      'frozen', 'issued')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_drawing_project ON drawing(project_id);
-- Document numbers are unique within a project (null numbers don't collide).
CREATE UNIQUE INDEX IF NOT EXISTS uq_drawing_project_docnum
  ON drawing(project_id, document_number)
  WHERE document_number IS NOT NULL;

-- Each attachment version links to its drawing (nullable until backfilled +
-- enforced in PR-5).
ALTER TABLE attachment ADD COLUMN IF NOT EXISTS drawing_id UUID
  REFERENCES drawing(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_attachment_drawing ON attachment(drawing_id);

-- ─── Backfill: one unclassified drawing per existing version_group ───────────
INSERT INTO drawing (project_id, org_id, version_group)
SELECT DISTINCT a.project_id, p.org_id, a.version_group
  FROM attachment a
  JOIN project p ON p.id = a.project_id
 WHERE a.version_group IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM drawing d WHERE d.version_group = a.version_group);

UPDATE attachment a
   SET drawing_id = d.id
  FROM drawing d
 WHERE d.version_group = a.version_group
   AND a.drawing_id IS NULL;

COMMIT;
