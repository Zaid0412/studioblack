-- Grandfather all existing users as email-verified.
-- Run this BEFORE deploying the email verification feature
-- to avoid locking out existing users.
--
-- Usage: psql $DATABASE_URL -f scripts/migrate-verify-existing-users.sql

UPDATE "user"
SET    "emailVerified" = true
WHERE  "emailVerified" = false
    OR "emailVerified" IS NULL;
