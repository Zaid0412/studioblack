-- Element category code auto-generation config (PRD "Coding system" tab).
--
-- One row per org holding the coding options (auto-generate vs manual, per-
-- segment max length, force-uppercase, prevent-duplicates, lock-after-use).
-- No seed INSERT: the getter returns hard-coded defaults for orgs with no row,
-- so existing orgs need no backfill and the feature is safe the instant this
-- lands.

CREATE TABLE IF NOT EXISTS category_code_config (
  org_id TEXT PRIMARY KEY REFERENCES "organization"(id) ON DELETE CASCADE,
  auto_generate      BOOLEAN  NOT NULL DEFAULT true,
  code_max_length    SMALLINT NOT NULL DEFAULT 4 CHECK (code_max_length IN (3, 4, 5)),
  force_uppercase    BOOLEAN  NOT NULL DEFAULT true,
  prevent_duplicates BOOLEAN  NOT NULL DEFAULT true,
  lock_after_use     BOOLEAN  NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
