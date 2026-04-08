-- Fix sent_to_client_by FK to allow user deletion (was RESTRICT by default)
ALTER TABLE attachment
  DROP CONSTRAINT IF EXISTS attachment_sent_to_client_by_fkey,
  ADD CONSTRAINT attachment_sent_to_client_by_fkey
    FOREIGN KEY (sent_to_client_by) REFERENCES "user"(id) ON DELETE SET NULL;
