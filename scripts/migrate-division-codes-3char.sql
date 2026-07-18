-- Division codes are now capped at 3 chars (they prefix every line reference,
-- `PLB-20`). The seeded default library had one 4-char code, HVAC — rename it to
-- HVC. Guarded so an org that already has an HVC (or a hand-edited HVAC) isn't
-- clobbered; the unique (org_id, lower(code)) index would reject a collision.
UPDATE division d
SET code = 'HVC', updated_at = now()
WHERE lower(d.code) = 'hvac'
  AND NOT EXISTS (
    SELECT 1 FROM division x
    WHERE x.org_id = d.org_id AND lower(x.code) = 'hvc'
  );
