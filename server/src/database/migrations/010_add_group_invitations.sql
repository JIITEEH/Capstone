-- A group leader invites a classmate, who accepts or declines. Before this, typing a classmate's email
-- added them to the group on the spot, so a student could end up on a thesis they never agreed to
-- join, and the error for someone already in a group told the leader which students were taken.
CREATE TABLE group_invitations (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  thesis_id    INTEGER NOT NULL REFERENCES theses(id) ON DELETE CASCADE,
  student_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  invited_by   INTEGER REFERENCES users(id) ON DELETE SET NULL,
  status       TEXT    NOT NULL DEFAULT 'pending'
               CHECK (status IN ('pending', 'accepted', 'declined', 'cancelled')),
  created_at   TEXT    NOT NULL DEFAULT (datetime('now')),
  responded_at TEXT
);

-- At most one open invitation from a group to the same student
CREATE UNIQUE INDEX idx_invitations_one_pending ON group_invitations(thesis_id, student_id) WHERE status = 'pending';
CREATE INDEX idx_invitations_student ON group_invitations(student_id, status);
