-- BOQ Divisions + BOQ-wide continuous line numbering (PRD tab 10.1 "BOQ Div/Section")
--
-- Adds an org-level Division library (reusable grouping above BOQ sections:
-- Project -> BOQ -> Division -> Section -> BOQ Item) and switches BOQ line
-- numbers from per-section to one continuous sequence per BOQ.

CREATE TABLE IF NOT EXISTS division (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id TEXT NOT NULL REFERENCES "organization"(id) ON DELETE CASCADE,
  code VARCHAR(10) NOT NULL,
  name VARCHAR(150) NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  enabled BOOLEAN NOT NULL DEFAULT true,
  is_default BOOLEAN NOT NULL DEFAULT true,  -- part of the new-project starter set
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_division_org ON division(org_id, sort_order);
CREATE UNIQUE INDEX IF NOT EXISTS uq_division_org_code ON division(org_id, lower(code));

-- Sections belong to the BOQ but reference the reusable org-level division.
-- SET NULL (not CASCADE): deleting/clearing a division drops sections into the
-- "Unassigned" bucket rather than deleting their items. Referenced divisions are
-- disabled in-app, never hard-deleted.
ALTER TABLE boq_section
  ADD COLUMN IF NOT EXISTS division_id UUID REFERENCES division(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_boq_section_division ON boq_section(division_id);

-- Seed the 12 default divisions for every existing org. Idempotent by
-- (org_id, lower(code)) so a re-run (or the "Restore defaults" flow) adds nothing.
INSERT INTO division (org_id, code, name, sort_order)
SELECT o.id, d.code, d.name, d.ord
FROM "organization" o
CROSS JOIN (VALUES
  ('GEN',  'General',           0),
  ('CIV',  'Civil Works',       1),
  ('STR',  'Structural Works',  2),
  ('MAS',  'Masonry',           3),
  ('PLB',  'Plumbing',          4),
  ('ELE',  'Electrical',        5),
  ('HVAC', 'HVAC',              6),
  ('INT',  'Interior Works',    7),
  ('KIT',  'Kitchen',           8),
  ('JNR',  'Joinery',           9),
  ('FLR',  'Flooring',          10),
  ('PNT',  'Painting',          11)
) AS d(code, name, ord)
WHERE NOT EXISTS (
  SELECT 1 FROM division x WHERE x.org_id = o.id AND lower(x.code) = lower(d.code)
);

-- One-time renumber: make every existing BOQ's line numbers continuous across
-- all its sections, gapped by the project's line_increment. Divisions aren't
-- assigned to sections yet, so order by (section.sort_order, item.sort_order,
-- created_at) -- the current on-screen order minus the new division layer.
-- boq.snapshot JSONB (locked/superseded BOQs) holds historical numbers and is
-- intentionally left untouched, matching how the other migrate-boq-* scripts
-- treat snapshots.
UPDATE boq_item bi
SET line_number = t.rn * pr.line_increment, updated_at = now()
FROM (
  SELECT x.id, x.boq_id,
         ROW_NUMBER() OVER (
           PARTITION BY x.boq_id
           ORDER BY COALESCE(bs.sort_order, 2147483647), x.sort_order, x.created_at
         ) AS rn
  FROM boq_item x
  LEFT JOIN boq_section bs ON bs.id = x.section_id
) t
JOIN boq b ON b.id = t.boq_id
JOIN project pr ON pr.id = b.project_id
WHERE bi.id = t.id;
