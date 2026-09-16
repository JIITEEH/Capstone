-- Records how a proposal or final defense went. Before this, an admin could schedule a defense and
-- pick a panel, but the most important milestone of a thesis left no trace: no scores, no remarks,
-- no verdict.

-- Each panelist's scores, 1 to 5 on each criterion, with written remarks. One row per panelist per
-- defense; a panelist can revise theirs until the verdict is recorded. The panelist's name is kept
-- so a result sheet still reads correctly if their account is later deleted.
CREATE TABLE defense_evaluations (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  schedule_id   INTEGER NOT NULL REFERENCES schedules(id) ON DELETE CASCADE,
  panelist_id   INTEGER REFERENCES users(id) ON DELETE SET NULL,
  panelist_name TEXT    NOT NULL,
  content       INTEGER NOT NULL CHECK (content BETWEEN 1 AND 5),
  methodology   INTEGER NOT NULL CHECK (methodology BETWEEN 1 AND 5),
  presentation  INTEGER NOT NULL CHECK (presentation BETWEEN 1 AND 5),
  answers       INTEGER NOT NULL CHECK (answers BETWEEN 1 AND 5),
  remarks       TEXT    NOT NULL DEFAULT '',
  created_at    TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT    NOT NULL DEFAULT (datetime('now')),
  UNIQUE (schedule_id, panelist_id)
);

CREATE INDEX idx_defense_evaluations_schedule ON defense_evaluations(schedule_id);

-- The panel's decision, recorded once per defense. Its own table rather than columns on schedules,
-- since consultations never have one.
CREATE TABLE defense_verdicts (
  schedule_id      INTEGER PRIMARY KEY REFERENCES schedules(id) ON DELETE CASCADE,
  verdict          TEXT    NOT NULL CHECK (verdict IN ('passed', 'passed_with_revisions', 'failed')),
  notes            TEXT    NOT NULL DEFAULT '',
  recorded_by      INTEGER REFERENCES users(id) ON DELETE SET NULL,
  recorded_by_name TEXT    NOT NULL,
  recorded_at      TEXT    NOT NULL DEFAULT (datetime('now'))
);
