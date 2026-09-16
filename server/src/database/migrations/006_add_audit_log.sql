-- A permanent record of what admins changed: roles, deactivations, deleted accounts, adviser
-- assignments, status overrides, and deleted theses. Answers "who did this, and when?" when a
-- student's account or thesis changes unexpectedly.
--
-- Names are copied in at the time of the change on purpose. Deleting a user must not erase the
-- record of who they were, or of what was done to them, so actor_name and target_label outlive the
-- rows they describe. The app never updates or deletes entries.
CREATE TABLE audit_log (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  actor_id     INTEGER REFERENCES users(id) ON DELETE SET NULL,
  actor_name   TEXT    NOT NULL,
  action       TEXT    NOT NULL,
  target_type  TEXT    NOT NULL CHECK (target_type IN ('user', 'thesis')),
  target_id    INTEGER,
  target_label TEXT    NOT NULL DEFAULT '',
  details      TEXT    NOT NULL DEFAULT '',
  created_at   TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_audit_log_newest ON audit_log(id DESC);
CREATE INDEX idx_audit_log_target ON audit_log(target_type, target_id);
