-- Migration: Add location and scope columns to project table
ALTER TABLE project ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE project ADD COLUMN IF NOT EXISTS city TEXT;
ALTER TABLE project ADD COLUMN IF NOT EXISTS state TEXT;
ALTER TABLE project ADD COLUMN IF NOT EXISTS scope TEXT;
ALTER TABLE project ADD COLUMN IF NOT EXISTS area_sqft NUMERIC;
ALTER TABLE project ADD COLUMN IF NOT EXISTS estimation_inr NUMERIC;
