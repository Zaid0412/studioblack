-- RFQ-3a: BOQ-item change versioning.
-- Immutable history of material (qty/spec/cost/dimension) edits to a BOQ item.
-- Each row snapshots the PRE-edit state of the boq_item plus why it changed.
--
-- Deliberately a SIDE snapshot table, NOT row-versioning of boq_item: boq_item
-- is the central procurement entity (referenced by rfq_item, rate contracts, BOQ
-- totals, the BOQ tab), so row-versioning it would force an `is_current` filter
-- on every read app-wide. This keeps the live row + all FKs stable and mirrors
-- the existing `boq.snapshot` precedent. Additive.

BEGIN;

CREATE TABLE IF NOT EXISTS boq_item_version (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  boq_item_id    UUID NOT NULL REFERENCES boq_item(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  change_reason  TEXT NOT NULL
    CHECK (change_reason IN ('quantity', 'specification', 'scope_add', 'scope_remove', 'other')),
  change_note    TEXT,
  changed_by     TEXT REFERENCES "user"(id) ON DELETE SET NULL,
  changed_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  snapshot       JSONB NOT NULL,
  UNIQUE (boq_item_id, version_number)
);

CREATE INDEX IF NOT EXISTS idx_boq_item_version_item
  ON boq_item_version (boq_item_id, version_number DESC);

COMMIT;
