-- Add sent_to_client_at column to attachment table
-- When NULL, file is hidden from client. When set, file is visible to client.
ALTER TABLE attachment ADD COLUMN IF NOT EXISTS sent_to_client_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE attachment ADD COLUMN IF NOT EXISTS sent_to_client_by TEXT REFERENCES "user"(id) DEFAULT NULL;
