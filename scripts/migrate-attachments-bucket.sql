-- Ensure the `attachments` Supabase Storage bucket is public-readable and has a
-- server-enforced 50 MB cap on each uploaded object.
--
-- The app validates fileSize on the signed-URL mint request, but Supabase does
-- NOT enforce that cap on the subsequent PUT unless `file_size_limit` is set on
-- the bucket row. Without this migration a client can request a 1 KB signed URL
-- and then PUT a 5 GB file — Supabase will happily accept it.
--
-- Run once per environment:
--   psql "$DATABASE_URL" -f scripts/migrate-attachments-bucket.sql

INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('attachments', 'attachments', true, 52428800)
ON CONFLICT (id) DO UPDATE
SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit;
