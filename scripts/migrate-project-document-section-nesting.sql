-- One level of nesting on project_document_section. `parent_id` references
-- another section in the same project; ON DELETE CASCADE removes the whole
-- subtree (and via the existing project_document FK, the docs inside it).
-- Depth is enforced at the query layer (no row whose parent already has a
-- parent) — Postgres can't express that with a CHECK constraint.
--
-- Position is now ordered per (project_id, parent_id) — siblings under the
-- same parent stay sequential. The new index supports both the sibling-
-- ordering reads and parent-lookup joins.
--
-- Run once per environment:
--   psql "$DATABASE_URL" -f scripts/migrate-project-document-section-nesting.sql

ALTER TABLE project_document_section
  ADD COLUMN IF NOT EXISTS parent_id uuid
    REFERENCES project_document_section(id) ON DELETE CASCADE;

-- Supports (a) per-parent sibling reads / MAX(position) for ordering, and
-- (b) the `c.parent_id = s.id` join in the rolled-up doc_count query.
-- Note: the existing `project_document_section_project_idx (project_id,
-- position)` is retained — it's a tighter match for the listDocumentSections
-- ORDER BY (which doesn't filter on parent_id), and pruning indexes for a
-- small table is more cost than benefit.
CREATE INDEX IF NOT EXISTS project_document_section_parent_idx
  ON project_document_section (project_id, parent_id, position);
