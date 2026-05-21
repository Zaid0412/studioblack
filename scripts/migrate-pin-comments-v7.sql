-- Pin comments v7: many shapes per comment
-- Run: psql $DATABASE_URL -f scripts/migrate-pin-comments-v7.sql

-- One row per shape annotation attached to a pin_comment. Each shape carries
-- its own geometry + style so a single comment can mix e.g. a red rectangle
-- and a blue circle on the same drawing.
CREATE TABLE IF NOT EXISTS pin_comment_shape (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pin_comment_id UUID NOT NULL REFERENCES pin_comment(id) ON DELETE CASCADE,
  shape_type TEXT NOT NULL,
  shape_data JSONB NOT NULL,
  shape_color TEXT,
  shape_stroke_width SMALLINT,
  shape_opacity NUMERIC(3, 2),
  shape_fill BOOLEAN,
  order_index SMALLINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT pin_comment_shape_type_check
    CHECK (shape_type IN ('rectangle', 'circle', 'freehand')),
  CONSTRAINT pin_comment_shape_color_check
    CHECK (shape_color IS NULL OR shape_color ~ '^#[0-9a-fA-F]{6}$'),
  CONSTRAINT pin_comment_shape_stroke_width_check
    CHECK (shape_stroke_width IS NULL OR shape_stroke_width BETWEEN 1 AND 10),
  CONSTRAINT pin_comment_shape_opacity_check
    CHECK (shape_opacity IS NULL OR (shape_opacity > 0 AND shape_opacity <= 1))
);

CREATE INDEX IF NOT EXISTS idx_pin_comment_shape_pin_comment_id
  ON pin_comment_shape(pin_comment_id);

-- Migrate existing single-shape rows into the child table so the new query
-- layer (which reads from pin_comment_shape) sees them as one-shape arrays.
-- Skip rows that have already been migrated (idempotent).
INSERT INTO pin_comment_shape (
  pin_comment_id, shape_type, shape_data, shape_color,
  shape_stroke_width, shape_opacity, shape_fill, order_index
)
SELECT pc.id, pc.shape_type, pc.shape_data, pc.shape_color,
       pc.shape_stroke_width, pc.shape_opacity, pc.shape_fill, 0
FROM pin_comment pc
WHERE pc.shape_type IS NOT NULL
  AND pc.shape_data IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM pin_comment_shape s WHERE s.pin_comment_id = pc.id
  );

-- The legacy pin_comment.shape_* columns are intentionally left in place
-- during the transition. They are no longer read or written by application
-- code. A follow-up cleanup migration will drop them once we're confident.
