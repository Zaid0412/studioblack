-- Pin comments v6: shape styling (stroke width, opacity, fill toggle)
-- Run: psql $DATABASE_URL -f scripts/migrate-pin-comments-v6.sql

-- Per-shape styling so the same color can render at different weights /
-- opacities, and so shapes can be filled or outline-only. All nullable and
-- only meaningful when shape_type is set.
ALTER TABLE pin_comment ADD COLUMN IF NOT EXISTS shape_stroke_width SMALLINT;
ALTER TABLE pin_comment ADD COLUMN IF NOT EXISTS shape_opacity NUMERIC(3, 2);
ALTER TABLE pin_comment ADD COLUMN IF NOT EXISTS shape_fill BOOLEAN;

ALTER TABLE pin_comment
  DROP CONSTRAINT IF EXISTS pin_comment_shape_stroke_width_check;
ALTER TABLE pin_comment
  ADD CONSTRAINT pin_comment_shape_stroke_width_check
  CHECK (shape_stroke_width IS NULL OR shape_stroke_width BETWEEN 1 AND 10);

ALTER TABLE pin_comment
  DROP CONSTRAINT IF EXISTS pin_comment_shape_opacity_check;
ALTER TABLE pin_comment
  ADD CONSTRAINT pin_comment_shape_opacity_check
  CHECK (shape_opacity IS NULL OR (shape_opacity > 0 AND shape_opacity <= 1));
