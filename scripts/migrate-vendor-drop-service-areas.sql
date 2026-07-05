-- Shared taxonomy (PR 2): retire the free-text vendor.service_areas column
--
-- Service areas are now the leaf (level-3) nodes of the shared element_category
-- tree; vendors map to them via vendor_trade (vendor_id → category_id). The old
-- free-text array is redundant.
--
-- Safe: checked prod (0 vendors with service_areas) and dev (1 test value) before
-- dropping — nothing to migrate.
--
-- Run: psql $DATABASE_URL -f scripts/migrate-vendor-drop-service-areas.sql

BEGIN;

ALTER TABLE vendor DROP COLUMN IF EXISTS service_areas;

COMMIT;
