-- Element master data (PRD sub-doc "2.2 Element ID updates").
--
-- Every BOQ line will link a real Element — reused or auto-created. This adds
-- the provenance/classification columns and the fuzzy-search support needed to
-- suggest duplicates before auto-creating. (The element_id NOT NULL enforcement
-- + backfill is a SEPARATE migration — see the plan's Stage 5.)

-- Trigram matching for the "similar elements" description search.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- element_type: provenance/approval class. Plain text + app-layer validation
-- (ELEMENT_TYPES in validations.ts), matching the codebase's status-column
-- convention (no DB enums / CHECKs). Existing rows are library-created -> standard.
--   standard          library-created & approved
--   custom            auto-created from a BOQ line
--   company_standard  a Custom element promoted to reusable
ALTER TABLE element
  ADD COLUMN IF NOT EXISTS element_type VARCHAR(20) NOT NULL DEFAULT 'standard',
  -- The BOQ a custom element was first created from (R4 provenance). Null for
  -- library-created. SET NULL keeps the element if that BOQ is ever deleted.
  ADD COLUMN IF NOT EXISTS origin_boq_id UUID REFERENCES boq(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_element_type ON element(org_id, element_type);

-- GIN trigram index on the description for the same-Service-Area dedup search.
CREATE INDEX IF NOT EXISTS idx_element_desc_trgm
  ON element USING GIN (lower(description) gin_trgm_ops);
