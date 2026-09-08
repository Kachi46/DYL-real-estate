-- Admin actions (verify/reject a listing, change a user's role, delete a
-- user, change an inspection's status, publish/edit/delete a post)
-- previously left no record of who did what, when. For a platform whose
-- entire premise is "listings are reviewed by a human," that
-- accountability trail matters - if a rejection gets disputed, or a role
-- change looks wrong in hindsight, there was no way to answer "who did
-- this and why" beyond asking around.
CREATE TABLE admin_actions (
  id SERIAL PRIMARY KEY,
  admin_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT,
  details JSONB,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- admin_id keeps the log even if the admin account is later deleted
-- (ON DELETE SET NULL rather than CASCADE) - the record of the action
-- matters independently of whether that admin account still exists.
CREATE INDEX idx_admin_actions_created_at ON admin_actions(created_at DESC);
CREATE INDEX idx_admin_actions_target ON admin_actions(target_type, target_id);
