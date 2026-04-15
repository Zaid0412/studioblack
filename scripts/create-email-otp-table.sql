-- Email OTP table for verifying identity of Google-only (passwordless) users
-- Used for: setting a password, confirming email changes
CREATE TABLE IF NOT EXISTS email_otp (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  code_hash TEXT NOT NULL,
  purpose TEXT NOT NULL CHECK (purpose IN ('set_password', 'email_change')),
  expires_at TIMESTAMPTZ NOT NULL,
  attempts INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for lookup by user + purpose (one active OTP per purpose per user)
CREATE INDEX IF NOT EXISTS idx_email_otp_user_purpose ON email_otp (user_id, purpose);

-- Cleanup: delete expired OTPs periodically (or rely on app-level cleanup)
