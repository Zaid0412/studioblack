-- F-EL-3 + F-EL-5: element thumbnail + production drawing + spec file
-- Adds five nullable columns to `element` for media references. All optional;
-- existing rows remain unaffected.

BEGIN;

ALTER TABLE element ADD COLUMN IF NOT EXISTS image_url TEXT;
ALTER TABLE element ADD COLUMN IF NOT EXISTS drawing_file_url TEXT;
ALTER TABLE element ADD COLUMN IF NOT EXISTS drawing_file_name VARCHAR(255);
ALTER TABLE element ADD COLUMN IF NOT EXISTS spec_file_url TEXT;
ALTER TABLE element ADD COLUMN IF NOT EXISTS spec_file_name VARCHAR(255);

COMMIT;
