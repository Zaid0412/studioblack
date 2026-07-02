-- Rate Contract field gaps (per the Rate Contract PRD tab, Tech spec §2/§3).
-- Additive: tax fields on the header + items, and an optional project link.
--   header: tax_included (Yes/No the rate is tax-inclusive), tax_percentage,
--           project_id (optional — a contract is usually org-wide, but may be
--           scoped to one project).
--   item:   tax_pct (per-line override of the header tax %).

BEGIN;

ALTER TABLE rate_contract
  ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES project(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS tax_included BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS tax_percentage NUMERIC(5, 2);

ALTER TABLE rate_contract_item
  ADD COLUMN IF NOT EXISTS tax_pct NUMERIC(5, 2);

COMMIT;
