-- Fix NOT NULL constraints on columns that use ON DELETE SET NULL.
-- These columns must be nullable for the FK cascade to work when a user is deleted.
--
-- Usage: psql $DATABASE_URL -f scripts/migrate-fix-nullable-fks.sql

ALTER TABLE attachment ALTER COLUMN uploaded_by DROP NOT NULL;
