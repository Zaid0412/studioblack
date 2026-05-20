-- Pin comments v5: shape annotations (rectangle, circle, freehand)
-- Run: psql $DATABASE_URL -f scripts/migrate-pin-comments-v5.sql

-- Annotation geometry alongside the pin marker.
-- shape_type NULL = plain pin (existing rows). Non-null = shape annotation.
-- shape_data holds percent-based geometry:
--   rectangle: { x, y, w, h }
--   circle:    { cx, cy, rx, ry }
--   freehand:  { points: [[x, y], ...] }
-- x_percent / y_percent continue to hold the anchor centroid for shapes,
-- so existing sort / select / index logic keeps working.
ALTER TABLE pin_comment ADD COLUMN IF NOT EXISTS shape_type TEXT;
ALTER TABLE pin_comment ADD COLUMN IF NOT EXISTS shape_data JSONB;
ALTER TABLE pin_comment ADD COLUMN IF NOT EXISTS shape_color TEXT;

ALTER TABLE pin_comment
  DROP CONSTRAINT IF EXISTS pin_comment_shape_type_check;
ALTER TABLE pin_comment
  ADD CONSTRAINT pin_comment_shape_type_check
  CHECK (shape_type IS NULL OR shape_type IN ('rectangle', 'circle', 'freehand'));

ALTER TABLE pin_comment
  DROP CONSTRAINT IF EXISTS pin_comment_shape_color_check;
ALTER TABLE pin_comment
  ADD CONSTRAINT pin_comment_shape_color_check
  CHECK (shape_color IS NULL OR shape_color ~ '^#[0-9a-fA-F]{6}$');

CREATE INDEX IF NOT EXISTS idx_pin_comment_shape_type
  ON pin_comment(shape_type)
  WHERE shape_type IS NOT NULL;
