-- Confirms a student owns the email address they signed up with. Before this, anyone could register
-- as a classmate and be added to that classmate's thesis group.
--
-- email_verified_at is NULL until the link in the verification email is used. Accounts created by
-- an admin are verified on creation, since the admin vouches for them.
ALTER TABLE users ADD COLUMN email_verified_at TEXT;

-- Every account that exists today was made before verification did. Mark them all verified, so the
-- upgrade itself locks nobody out.
UPDATE users SET email_verified_at = created_at;

-- One-time verification links. Like password resets, only a SHA-256 hash of the token is stored.
CREATE TABLE email_verifications (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT    NOT NULL UNIQUE,
  expires_at TEXT    NOT NULL,
  created_at TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_email_verifications_user ON email_verifications(user_id);
