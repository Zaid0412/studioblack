-- Per-project Documents: user-defined sections (MoM, Gov Approvals, etc.) each
-- holding uploaded files. Separate from `attachment` (design files) so we keep
-- distinct retention/permission semantics for legal & administrative docs.
--
-- Run once per environment:
--   psql "$DATABASE_URL" -f scripts/migrate-project-documents.sql

CREATE TABLE IF NOT EXISTS project_document_section (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id   uuid NOT NULL REFERENCES project(id) ON DELETE CASCADE,
  name         text NOT NULL,
  icon         text NOT NULL DEFAULT 'folder',
  position     integer NOT NULL DEFAULT 0,
  created_by   text NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS project_document_section_project_idx
  ON project_document_section(project_id, position);

CREATE TABLE IF NOT EXISTS project_document (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id    uuid NOT NULL REFERENCES project(id) ON DELETE CASCADE,
  section_id    uuid NOT NULL REFERENCES project_document_section(id) ON DELETE CASCADE,
  file_name     text NOT NULL,
  file_size     bigint NOT NULL CHECK (file_size > 0),
  mime_type     text NOT NULL,
  storage_path  text NOT NULL,
  uploaded_by   text NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS project_document_section_idx
  ON project_document(section_id, created_at DESC);
CREATE INDEX IF NOT EXISTS project_document_project_idx
  ON project_document(project_id, created_at DESC);
