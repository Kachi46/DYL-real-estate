-- The existing rate limiter (middleware/rateLimit.js) caps login attempts
-- per IP address, which stops a single attacker hammering the endpoint
-- but does nothing against a distributed attempt - many IPs, each well
-- under the per-IP cap, all guessing passwords for one specific account.
-- This adds an account-level counter as a second, independent layer:
-- after repeated failures *on this account* it locks regardless of how
-- many different IPs the attempts came from.
ALTER TABLE users ADD COLUMN failed_login_attempts INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN locked_until TIMESTAMP;
