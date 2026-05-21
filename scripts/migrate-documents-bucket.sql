-- Create the private `documents` Supabase Storage bucket used by per-project
-- documents (MoM, Gov approvals, contracts, etc.). Documents may contain
-- sensitive material so the bucket is NOT public — downloads go through
-- short-lived signed URLs minted by the app.
--
-- Run once per environment:
--   psql "$DATABASE_URL" -f scripts/migrate-documents-bucket.sql

INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('documents', 'documents', false, 52428800)
ON CONFLICT (id) DO UPDATE
SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit;
