-- JWTs are stateless, so there was previously no way to invalidate a
-- token before it naturally expires (up to 7 days later) - not on
-- password change, not on password reset, not if an account is
-- compromised. token_version is embedded in every newly issued token and
-- checked against the current column value on every authenticated
-- request; bumping it (on password change/reset) instantly invalidates
-- every token issued before that point.
ALTER TABLE users ADD COLUMN token_version INTEGER NOT NULL DEFAULT 0;
