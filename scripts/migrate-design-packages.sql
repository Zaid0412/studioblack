-- Design → Document Control Module, PR-1: Package backbone.
--
-- Introduces the two grouping tables the document-control register hangs off:
--   * design_discipline — per-org lookup (Architecture, Structural, …), extendable
--   * design_package    — per-project milestone submissions (Concept, Schematic, …)
--
-- Purely additive: the legacy `project_phase` design grouping is untouched here;
-- packages sit alongside phases until the PR-5 cutover retires phases.
--
-- Idempotent: re-runnable. Seeds defaults for existing orgs/projects via
-- NOT EXISTS guards, so it also backfills data created before this migration.

BEGIN;

-- ─── Disciplines (per-org lookup) ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS design_discipline (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id TEXT NOT NULL REFERENCES "organization"(id) ON DELETE CASCADE,
  code VARCHAR(10) NOT NULL,
  name VARCHAR(80) NOT NULL,
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_design_discipline_org ON design_discipline(org_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_design_discipline_org_code
  ON design_discipline(org_id, lower(code));

-- ─── Packages (per-project grouping) ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS design_package (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES project(id) ON DELETE CASCADE,
  org_id TEXT NOT NULL REFERENCES "organization"(id) ON DELETE CASCADE,
  code VARCHAR(10) NOT NULL,
  name VARCHAR(80) NOT NULL,
  sort_order INTEGER DEFAULT 0,
  -- 10-state lifecycle, enforced app-side (like project_phase.status). The
  -- declarative state machine lands in PR-4; PR-1 only seeds the initial state.
  status VARCHAR(30) NOT NULL DEFAULT 'draft',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_design_package_project ON design_package(project_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_design_package_project_code
  ON design_package(project_id, code);

-- ─── Backfill defaults for existing data ────────────────────────────────────

-- 10 disciplines per existing org.
INSERT INTO design_discipline (org_id, code, name, sort_order)
SELECT o.id, d.code, d.name, d.ord - 1
  FROM "organization" o
  CROSS JOIN unnest(
    ARRAY['AR','ID','ST','EL','PL','ME','HVAC','LS','FF','3D'],
    ARRAY['Architecture','Interior Design','Structural','Electrical','Plumbing',
          'Mechanical','HVAC','Landscape','Furniture','Visualization']
  ) WITH ORDINALITY AS d(code, name, ord)
 WHERE NOT EXISTS (
   SELECT 1 FROM design_discipline x
    WHERE x.org_id = o.id AND lower(x.code) = lower(d.code)
 );

-- 6 packages per existing project.
INSERT INTO design_package (project_id, org_id, code, name, sort_order)
SELECT p.id, p.org_id, d.code, d.name, d.ord - 1
  FROM project p
  CROSS JOIN unnest(
    ARRAY['CON','SCH','DD','TD','IFC','ASB'],
    ARRAY['Concept Design','Schematic Design','Design Development',
          'Technical / Tender Design','Issued for Construction','As-Built Documentation']
  ) WITH ORDINALITY AS d(code, name, ord)
 WHERE NOT EXISTS (
   SELECT 1 FROM design_package x
    WHERE x.project_id = p.id AND x.code = d.code
 );

COMMIT;
