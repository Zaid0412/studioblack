-- Version history on project_document. Each upload appends a new row that
-- shares a version_group UUID with its predecessors; the version int
-- increments inside the group. Lists return the highest-version row per
-- group ("the current document"); the full history is exposed via a
-- dedicated endpoint.
--
-- DEFAULT gen_random_uuid() is evaluated per row, so existing rows each get
-- their own unique version_group at version 1 — backwards-compatible.
--
-- Revert is implemented as "promote-as-new-version" (append a new row whose
-- file fields match the target version), so this table also stores revert
-- events. Append-only — no row is ever rewritten by a revert.
--
-- Run once per environment:
--   psql "$DATABASE_URL" -f scripts/migrate-project-document-versions.sql

ALTER TABLE project_document
  ADD COLUMN IF NOT EXISTS version INT NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS version_group UUID NOT NULL DEFAULT gen_random_uuid();

CREATE INDEX IF NOT EXISTS project_document_version_group_idx
  ON project_document (version_group, version DESC);
