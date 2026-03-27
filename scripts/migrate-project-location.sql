-- Migration: Add address, city, state columns to project table
ALTER TABLE project ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE project ADD COLUMN IF NOT EXISTS city TEXT;
ALTER TABLE project ADD COLUMN IF NOT EXISTS state TEXT;
