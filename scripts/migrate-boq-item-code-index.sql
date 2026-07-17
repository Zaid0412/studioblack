-- Index boq_item.item_code.
--
-- The element-code generator (`generateElementCode`) now verifies each candidate
-- against boq_item.item_code as well as element.code — a manual BOQ line draws
-- the same per-prefix sequence as a library element, so the two share one code
-- namespace. That collision check (and the counter self-heal) filter
-- `WHERE item_code = $code`, so index the column to keep every element / BOQ
-- create off a sequential scan.
--
-- CONCURRENTLY so building it doesn't lock writes on boq_item. Run OUTSIDE a
-- transaction (psql, not a wrapped migration) — `CREATE INDEX CONCURRENTLY`
-- cannot run inside one.

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_boq_item_code ON boq_item(item_code);
