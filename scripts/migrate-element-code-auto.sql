-- Element codes become system-assigned and sequential:
--   <category code_prefix>-<4-digit sequence>   e.g. KIT-CAB-BASE-0001
-- (`GEN-0001` when the element has no category, or its category has no code.)
--
-- Codes were free text before this, so every existing element is renumbered and
-- the counters are seeded past what was issued. Numbering is per `version_group`
-- (see migrate-element-versions.sql): all versions of an element share one code,
-- so numbering rows individually would split a version chain across two codes.
--
-- No unique constraint is added: versions deliberately share a code, and
-- cross-group uniqueness stays app-enforced under pg_advisory_xact_lock.

BEGIN;

CREATE TEMP TABLE _recode ON COMMIT DROP AS
WITH latest AS (
  -- The newest version of each group owns the category the code is built from.
  SELECT DISTINCT ON (org_id, version_group)
         org_id, version_group, category_id, created_at
  FROM element
  ORDER BY org_id, version_group, version_number DESC
)
SELECT l.org_id,
       l.version_group,
       COALESCE(NULLIF(TRIM(c.code_prefix), ''), 'GEN') AS prefix,
       ROW_NUMBER() OVER (
         PARTITION BY l.org_id, COALESCE(NULLIF(TRIM(c.code_prefix), ''), 'GEN')
         ORDER BY l.created_at, l.version_group
       ) AS seq
FROM latest l
-- Org-scoped, matching elementCodePrefix(): an element pointing at another
-- org's category must code as GEN here too, or the migration and the app would
-- disagree about its prefix.
LEFT JOIN element_category c
       ON c.id = l.category_id
      AND c.org_id = l.org_id;

-- LPAD truncates from the right when the value is already longer than the pad
-- width — LPAD('10000', 4, '0') is '1000', which would collide with row 1000.
-- Past 9999 the sequence just grows, exactly as padStart(4, "0") does at runtime.
UPDATE element e
   SET code = r.prefix || '-' ||
              CASE WHEN r.seq < 10000
                   THEN LPAD(r.seq::text, 4, '0')
                   ELSE r.seq::text
              END,
       updated_at = now()
  FROM _recode r
 WHERE e.org_id = r.org_id
   AND e.version_group = r.version_group;

-- year = 0 marks a counter that never resets. Element codes are stable library
-- identifiers, unlike the document sequences (BOQ, RFQ) that restart each year.
INSERT INTO sequence_counter (org_id, prefix, year, current_value)
SELECT org_id, prefix, 0, MAX(seq)
  FROM _recode
 GROUP BY org_id, prefix
    ON CONFLICT (org_id, prefix, year) DO UPDATE
   SET current_value = GREATEST(
         sequence_counter.current_value,
         EXCLUDED.current_value
       );

COMMIT;
