-- Registration currently accepts any email address with no proof the
-- registrant actually controls it. This adds a verified flag plus a
-- token table (same shape/expiry pattern as password_reset_tokens) so a
-- confirmation link can be emailed and checked off.
ALTER TABLE users ADD COLUMN email_verified BOOLEAN NOT NULL DEFAULT false;

-- Accounts created via Google sign-in already have a Google-verified
-- email by definition - no link to click, nothing to backfill for them.
UPDATE users SET email_verified = true WHERE google_id IS NOT NULL;

CREATE TABLE email_verification_tokens (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMP NOT NULL,
  used_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_email_verification_tokens_lookup
  ON email_verification_tokens(token_hash, expires_at);
