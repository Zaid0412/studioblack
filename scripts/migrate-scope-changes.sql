-- Feature §21–22: Scope-Change workflow.
-- A governed request to change a BOQ item after it has entered procurement.
-- Lifecycle mirrors the rate-contract approval pattern:
--   requested -> under_review -> client_approval -> approved -> implemented
-- with `rejected` as a terminal state. On `implement`, the change executes its
-- `impact` (edit BOQ item -> version, revise/create RFQ, or cancel the item)
-- and links the resulting boq_item_version / rfq back onto the row.

BEGIN;

CREATE TABLE IF NOT EXISTS scope_change (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id TEXT NOT NULL REFERENCES "organization"(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES project(id) ON DELETE CASCADE,
  boq_item_id UUID NOT NULL REFERENCES boq_item(id) ON DELETE CASCADE,
  sc_number VARCHAR(50) UNIQUE NOT NULL,
  change_reason VARCHAR(20) NOT NULL
    CHECK (change_reason IN ('quantity','specification','scope_add','scope_remove')),
  description TEXT,
  impact VARCHAR(20) NOT NULL
    CHECK (impact IN ('update_rfq','requote','new_rfq','cancel_item')),
  status VARCHAR(20) NOT NULL DEFAULT 'requested'
    CHECK (status IN (
      'requested','under_review','client_approval','approved','implemented','rejected'
    )),
  -- Requester (studio) + workflow actor stamps. All user ids are plain TEXT
  -- with ON DELETE SET NULL, mirroring rate_contract.created_by/approved_by.
  requested_by TEXT REFERENCES "user"(id) ON DELETE SET NULL,
  submitted_at TIMESTAMPTZ,
  reviewed_by TEXT REFERENCES "user"(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  review_note TEXT,
  client_decision_by TEXT REFERENCES "user"(id) ON DELETE SET NULL,
  client_decided_at TIMESTAMPTZ,
  client_decision_note TEXT,
  -- Set by `implement`: the resulting BOQ version and/or RFQ (revision or new).
  boq_item_version_id UUID REFERENCES boq_item_version(id) ON DELETE SET NULL,
  rfq_id UUID REFERENCES rfq(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- List/rollup: scope changes for a project by status; per-item lookup.
CREATE INDEX IF NOT EXISTS idx_scope_change_project
  ON scope_change(org_id, project_id, status);
CREATE INDEX IF NOT EXISTS idx_scope_change_boq_item
  ON scope_change(boq_item_id);

-- §22 cancel_item impact: BOQ items gain a terminal `cancelled` phase. Additive
-- widen of the phase CHECK (adding a value without this fails the constraint).
ALTER TABLE boq_item DROP CONSTRAINT IF EXISTS boq_item_phase_check;
ALTER TABLE boq_item ADD CONSTRAINT boq_item_phase_check CHECK (
  phase IN (
    'draft','internal_review','internal_changes_requested','internally_approved',
    'sent_to_client','client_reviewing','client_changes_requested','client_approved',
    'ready_for_procurement','cancelled'
  )
);

COMMIT;
