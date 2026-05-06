-- Indexes supporting the approval-flavoured task buckets.
--
-- `getTaskBucketCounts` and `getApprovalRows` filter `pin_comment` and
-- `comment` by `user_id` for `my_requests` / `my_comments` / `all_requests`.
-- Without these indexes, every sidebar render does a sequential scan over
-- both tables — fine for small orgs, painful once review activity grows.
--
-- Run: psql $DATABASE_URL -f scripts/migrate-approval-bucket-indexes.sql

CREATE INDEX IF NOT EXISTS idx_pin_comment_user ON pin_comment(user_id);
CREATE INDEX IF NOT EXISTS idx_comment_user ON comment(user_id);
