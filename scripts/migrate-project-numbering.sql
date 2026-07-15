-- Project-rooted numbering (PRD tab 20). Every business document is numbered
-- off its project:
--   project              P2026-001            (per-org, per-year, restarts Jan)
--   BOQ document         P2026-001-BOQ-001    (per-project, never resets)
--   BOQ line item        line 10, 20, 30…     (gapped, per section)
--   RFQ                  P2026-001-RFQ-001    (per-project, never resets)
--
-- Existing data is reformatted: projects get numbered by creation order within
-- their org+year, BOQs and RFQs are re-issued under their project, and BOQ items
-- get gapped line numbers. The per-item `item_code` stops being a business number
-- (its auto `BOQ-YYYY-NNN` values are cleared) and keeps only its element-link
-- role. Counters are seeded past what was issued so live generation never
-- collides.
--
-- Idempotent: every backfill is gated so a second run is a no-op, and counter
-- seeds use GREATEST.
--
-- Run: psql $DATABASE_URL -f scripts/migrate-project-numbering.sql

BEGIN;

-- ── Schema ────────────────────────────────────────────────────────────────
ALTER TABLE project   ADD COLUMN IF NOT EXISTS project_number VARCHAR(20);
ALTER TABLE boq       ADD COLUMN IF NOT EXISTS boq_number     VARCHAR(30);
ALTER TABLE boq_item  ADD COLUMN IF NOT EXISTS line_number    INTEGER;
ALTER TABLE boq_item  ALTER COLUMN item_code DROP NOT NULL;

-- ── Projects: P{year}-NNN ─────────────────────────────────────────────────
-- UTC year, matching nextProjectNumber()'s getUTCFullYear() at runtime.
CREATE TEMP TABLE _proj ON COMMIT DROP AS
SELECT id,
       org_id,
       date_part('year', created_at AT TIME ZONE 'UTC')::int AS yr,
       ROW_NUMBER() OVER (
         PARTITION BY org_id, date_part('year', created_at AT TIME ZONE 'UTC')
         ORDER BY created_at, id
       ) AS seq
FROM project
WHERE project_number IS NULL;

UPDATE project p
   SET project_number = 'P' || t.yr::text || '-' || LPAD(t.seq::text, 3, '0'),
       updated_at = now()
  FROM _proj t
 WHERE p.id = t.id;

INSERT INTO sequence_counter (org_id, prefix, year, current_value)
SELECT org_id, 'P', yr, MAX(seq)
  FROM _proj GROUP BY org_id, yr
    ON CONFLICT (org_id, prefix, year) DO UPDATE
   SET current_value = GREATEST(sequence_counter.current_value, EXCLUDED.current_value);

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'project_org_number_key'
  ) THEN
    ALTER TABLE project
      ADD CONSTRAINT project_org_number_key UNIQUE (org_id, project_number);
  END IF;
END $$;

-- ── BOQ documents: {project}-BOQ-NNN ──────────────────────────────────────
CREATE TEMP TABLE _boq ON COMMIT DROP AS
SELECT b.id,
       p.org_id,
       p.project_number,
       ROW_NUMBER() OVER (
         PARTITION BY b.project_id
         ORDER BY b.created_at, b.id
       ) AS seq
FROM boq b
JOIN project p ON p.id = b.project_id
WHERE b.boq_number IS NULL
  AND p.project_number IS NOT NULL;

UPDATE boq b
   SET boq_number = t.project_number || '-BOQ-' || LPAD(t.seq::text, 3, '0'),
       updated_at = now()
  FROM _boq t
 WHERE b.id = t.id;

INSERT INTO sequence_counter (org_id, prefix, year, current_value)
SELECT org_id, project_number || '-BOQ', 0, MAX(seq)
  FROM _boq GROUP BY org_id, project_number
    ON CONFLICT (org_id, prefix, year) DO UPDATE
   SET current_value = GREATEST(sequence_counter.current_value, EXCLUDED.current_value);

-- ── BOQ line numbers: gapped 10, 20, 30… per section ──────────────────────
UPDATE boq_item bi
   SET line_number = t.line_no
  FROM (
    SELECT id,
           ROW_NUMBER() OVER (
             PARTITION BY boq_id, section_id
             ORDER BY sort_order, created_at, id
           ) * 10 AS line_no
    FROM boq_item
    WHERE line_number IS NULL
  ) t
 WHERE bi.id = t.id;

-- Old auto per-item business numbers are superseded by the line number; drop
-- them but keep any user/import-supplied element code.
UPDATE boq_item
   SET item_code = NULL
 WHERE item_code ~ '^BOQ-\d{4}-\d{3}$';

ALTER TABLE boq_item ALTER COLUMN line_number SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_boq_item_line ON boq_item(boq_id, line_number);

-- ── RFQ: {project}-RFQ-NNN, revisions keep their base ─────────────────────
-- A revision chain shares one base rfq_number, so map by the old base and give
-- every revision in the chain the same new base.
CREATE TEMP TABLE _rfq ON COMMIT DROP AS
WITH chains AS (
  SELECT org_id, project_id, rfq_number AS old_number,
         MIN(created_at) AS first_created
  FROM rfq
  WHERE rfq_number ~ '^RFQ-'
  GROUP BY org_id, project_id, rfq_number
),
numbered AS (
  SELECT c.*,
         ROW_NUMBER() OVER (
           PARTITION BY c.project_id
           ORDER BY c.first_created, c.old_number
         ) AS seq
  FROM chains c
)
SELECT n.org_id,
       n.project_id,
       n.old_number,
       p.project_number,
       p.project_number || '-RFQ-' || LPAD(n.seq::text, 3, '0') AS new_number,
       n.seq
FROM numbered n
JOIN project p ON p.id = n.project_id
WHERE p.project_number IS NOT NULL;

UPDATE rfq r
   SET rfq_number = t.new_number,
       updated_at = now()
  FROM _rfq t
 WHERE r.org_id = t.org_id
   AND r.project_id = t.project_id
   AND r.rfq_number = t.old_number;

INSERT INTO sequence_counter (org_id, prefix, year, current_value)
SELECT org_id, project_number || '-RFQ', 0, MAX(seq)
  FROM _rfq GROUP BY org_id, project_number
    ON CONFLICT (org_id, prefix, year) DO UPDATE
   SET current_value = GREATEST(sequence_counter.current_value, EXCLUDED.current_value);

COMMIT;
