-- Tells people when something happens that concerns them: a submission waiting for review, a
-- review decision, a new comment, an adviser assignment, being added to a group, or a new event.
-- Before this, students refreshed pages to see whether their chapters had been reviewed and
-- advisers missed new submissions.
--
-- One row per recipient, so each person reads and dismisses their own copy.
CREATE TABLE notifications (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  actor_id   INTEGER REFERENCES users(id) ON DELETE SET NULL,
  type       TEXT    NOT NULL,
  title      TEXT    NOT NULL,
  body       TEXT    NOT NULL DEFAULT '',
  link       TEXT    NOT NULL DEFAULT '',
  read_at    TEXT,
  created_at TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- The bell asks "what's unread for me, newest first" on every page
CREATE INDEX idx_notifications_user_newest ON notifications(user_id, id DESC);
CREATE INDEX idx_notifications_user_unread ON notifications(user_id) WHERE read_at IS NULL;
