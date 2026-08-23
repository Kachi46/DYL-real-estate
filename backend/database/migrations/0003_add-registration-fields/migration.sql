-- user_type was being collected on the registration form and sent to the
-- API, but there was no column for it - it was silently discarded, and
-- every account ended up defaulting to "seeker" regardless of what was
-- picked. This actually persists it.
ALTER TABLE users
  ADD COLUMN user_type TEXT NOT NULL DEFAULT 'user'
    CHECK (user_type IN ('user', 'landlord', 'agent', 'developer'));

-- Split name fields, matching the registration form design. `name` stays
-- as the single source of truth everywhere else in the app already reads
-- it from (dashboards, admin views, agent cards, JWTs) - these are
-- additive, computed from it, not a replacement for it.
ALTER TABLE users ADD COLUMN first_name TEXT;
ALTER TABLE users ADD COLUMN last_name TEXT;

-- Best-effort backfill for existing accounts: split the current `name` on
-- the first space.
UPDATE users
SET
  first_name = split_part(name, ' ', 1),
  last_name = NULLIF(
    TRIM(SUBSTRING(name FROM LENGTH(split_part(name, ' ', 1)) + 1)),
    ''
  )
WHERE first_name IS NULL;

-- Real column for the "email preferences" opt-in choice on the
-- registration form.
ALTER TABLE users
  ADD COLUMN email_opt_in BOOLEAN NOT NULL DEFAULT false;
