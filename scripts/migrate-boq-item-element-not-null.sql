-- Enforce R1 (PRD 2.2): every BOQ line must link an Element.
--
-- PREREQUISITE: run `scripts/backfill-boq-element-ids.ts` against this DB first
-- so no `boq_item.element_id` is NULL — otherwise the SET NOT NULL below errors.
-- (Guard: SELECT count(*) FROM boq_item WHERE element_id IS NULL; must be 0.)

-- All-or-nothing: the NOT NULL and the FK swap must land together, so a failure
-- (e.g. the DROP succeeds but the ADD hits a lock timeout) can't leave the table
-- NOT NULL with no element FK. (apply_migration wraps this too — belt + braces.)
BEGIN;

ALTER TABLE boq_item ALTER COLUMN element_id SET NOT NULL;

-- A line's element can no longer be nulled out from under it: elements are
-- soft-deleted (is_active = false), never hard-deleted, so flip the FK from
-- ON DELETE SET NULL to RESTRICT — a hard delete of a referenced element now
-- fails loudly instead of violating the NOT NULL.
ALTER TABLE boq_item DROP CONSTRAINT boq_item_element_id_fkey;
ALTER TABLE boq_item
  ADD CONSTRAINT boq_item_element_id_fkey
  FOREIGN KEY (element_id) REFERENCES element(id) ON DELETE RESTRICT;

COMMIT;
