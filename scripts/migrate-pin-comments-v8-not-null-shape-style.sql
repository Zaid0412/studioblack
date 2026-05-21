-- Pin comments v8: tighten shape style columns
-- Run: psql $DATABASE_URL -f scripts/migrate-pin-comments-v8-not-null-shape-style.sql

-- Tighten shape style columns to NOT NULL with sensible defaults so the DB
-- schema matches what `pinShapeSchema` (Zod) and the renderer expect. The v7
-- migration left these nullable because legacy single-shape rows on
-- pin_comment could omit them; the renderer now uses DEFAULT_SHAPE_* constants
-- to fill any historical NULLs, and we want the DB to enforce the contract
-- going forward.
ALTER TABLE pin_comment_shape ALTER COLUMN shape_color SET DEFAULT '#F5C518';
ALTER TABLE pin_comment_shape ALTER COLUMN shape_stroke_width SET DEFAULT 2;
ALTER TABLE pin_comment_shape ALTER COLUMN shape_opacity SET DEFAULT 1;
ALTER TABLE pin_comment_shape ALTER COLUMN shape_fill SET DEFAULT false;

UPDATE pin_comment_shape SET shape_color = '#F5C518' WHERE shape_color IS NULL;
UPDATE pin_comment_shape SET shape_stroke_width = 2 WHERE shape_stroke_width IS NULL;
UPDATE pin_comment_shape SET shape_opacity = 1 WHERE shape_opacity IS NULL;
UPDATE pin_comment_shape SET shape_fill = false WHERE shape_fill IS NULL;

ALTER TABLE pin_comment_shape ALTER COLUMN shape_color SET NOT NULL;
ALTER TABLE pin_comment_shape ALTER COLUMN shape_stroke_width SET NOT NULL;
ALTER TABLE pin_comment_shape ALTER COLUMN shape_opacity SET NOT NULL;
ALTER TABLE pin_comment_shape ALTER COLUMN shape_fill SET NOT NULL;
