-- Records each deadline reminder sent to a group, so the daily reminder job never sends the same one
-- twice. Before this, due dates showed on dashboards but nobody was told as one approached or passed.
--
-- The due date is part of the key: if an admin moves a deadline, the group is reminded about the new date.
CREATE TABLE deadline_reminders (
  thesis_id INTEGER NOT NULL REFERENCES theses(id) ON DELETE CASCADE,
  stage     TEXT    NOT NULL CHECK (stage IN ('proposal', 'chapters_1_3', 'chapters_4_5', 'final')),
  due_on    TEXT    NOT NULL,
  kind      TEXT    NOT NULL CHECK (kind IN ('due_soon', 'overdue')),
  sent_at   TEXT    NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (thesis_id, stage, due_on, kind)
);
