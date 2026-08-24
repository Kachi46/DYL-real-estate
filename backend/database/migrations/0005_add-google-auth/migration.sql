-- Links an account to a verified Google identity. Nullable/unique - most
-- accounts won't have one, and no two accounts can share the same Google ID.
ALTER TABLE users ADD COLUMN google_id TEXT UNIQUE;

-- Accounts created via "Sign in with Google" never set a password, so this
-- can no longer be required at the database level. The login route already
-- needs to guard against a null password_hash regardless.
ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;
