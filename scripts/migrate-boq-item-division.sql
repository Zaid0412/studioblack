-- Mandatory per-item Division + per-division line numbering (PRD sub-doc
-- "BOQ Structure & Division Design", §§2-4).
--
-- Divisions move from the BOQ section onto the line itself and become MANDATORY,
-- and line numbers switch from BOQ-wide continuous (migrate-boq-divisions.sql /
-- #207) to restarting at the increment for EACH division (DIV -> 10, 20, 30…).
-- The line's business reference is then `<division.code>-<line_number>` (PLB-20).
--
-- Safe to run once: the column add / index are IF (NOT) EXISTS and the GEN
-- backfill is guarded, so re-running errors nothing. Step 4, however, renumbers
-- EVERY line to clean division multiples — running it again after go-live would
-- overwrite any insert-between midpoints (e.g. PLB-15 back to 10/20/30). This is
-- a one-time migration; don't re-run it against a live BOQ.
-- boq.snapshot JSONB (locked/superseded BOQs) holds historical numbers and is
-- intentionally left untouched, matching the other migrate-boq-* scripts.

-- 1. Nullable column first so the backfill can populate it before NOT NULL.
--    No ON DELETE action (default NO ACTION / RESTRICT): a division referenced by
--    a line can't be hard-deleted — the app disables it instead (deleteDivision).
ALTER TABLE boq_item
  ADD COLUMN IF NOT EXISTS division_id UUID REFERENCES division(id);

-- 2. Guarantee every org has a General (GEN) division to catch undivisioned
--    lines. migrate-boq-divisions.sql already seeds it; re-assert defensively.
INSERT INTO division (org_id, code, name, sort_order)
SELECT o.id, 'GEN', 'General', 0
FROM "organization" o
WHERE NOT EXISTS (
  SELECT 1 FROM division x WHERE x.org_id = o.id AND lower(x.code) = 'gen'
);

-- 3. Backfill: a line's division is its section's division, else the org's GEN.
--    The section's division is a correlated scalar subquery (Postgres forbids
--    joining another FROM table to the UPDATE target `bi` in an ON clause); GEN
--    comes via the project's org in the FROM.
UPDATE boq_item bi
SET division_id = COALESCE(
      (SELECT bs.division_id FROM boq_section bs WHERE bs.id = bi.section_id),
      gen.id
    )
FROM boq b
JOIN project p ON p.id = b.project_id
LEFT JOIN division gen ON gen.org_id = p.org_id AND lower(gen.code) = 'gen'
WHERE bi.boq_id = b.id
  AND bi.division_id IS NULL;

-- 4. One-time renumber: restart line numbers at the increment for each division
--    within a BOQ, in the app's display order (item division rank, then section
--    rank, then item order). Matches renumberBoqContinuous's new partitioning.
UPDATE boq_item bi
SET line_number = t.rn * pr.line_increment, updated_at = now()
FROM (
  SELECT x.id, x.boq_id,
         ROW_NUMBER() OVER (
           PARTITION BY x.boq_id, x.division_id
           ORDER BY COALESCE(idiv.sort_order, 2147483647),
                    COALESCE(bs.sort_order, 2147483647),
                    x.sort_order, x.created_at
         ) AS rn
  FROM boq_item x
  LEFT JOIN boq_section bs ON bs.id = x.section_id
  LEFT JOIN division idiv ON idiv.id = x.division_id
) t
JOIN boq b ON b.id = t.boq_id
JOIN project pr ON pr.id = b.project_id
WHERE bi.id = t.id;

-- 5. Now that every row has one, make it mandatory.
ALTER TABLE boq_item ALTER COLUMN division_id SET NOT NULL;

-- 6. Line numbers are unique per (boq, division) now, not per boq — the lookup
--    index follows. Drop the old BOQ-wide one from migrate-project-numbering.sql.
DROP INDEX IF EXISTS idx_boq_item_line;
CREATE INDEX IF NOT EXISTS idx_boq_item_line
  ON boq_item(boq_id, division_id, line_number);
