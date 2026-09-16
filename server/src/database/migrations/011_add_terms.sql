-- Academic terms with a due date for each thesis stage, so a coordinator can see which groups are
-- behind. Before this, stages had no deadlines and theses weren't tied to a semester.
--
-- Due dates are calendar days (YYYY-MM-DD). A stage is due by the end of that day in the server's
-- time zone; see DEPLOYMENT.md.
CREATE TABLE terms (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT    NOT NULL UNIQUE COLLATE NOCASE,
  starts_on  TEXT    NOT NULL,
  ends_on    TEXT    NOT NULL,
  is_current INTEGER NOT NULL DEFAULT 0 CHECK (is_current IN (0, 1)),
  created_at TEXT    NOT NULL DEFAULT (datetime('now')),
  CHECK (ends_on >= starts_on)
);

-- New theses join the current term, so at most one term can be current
CREATE UNIQUE INDEX idx_terms_one_current ON terms(is_current) WHERE is_current = 1;

CREATE TABLE term_deadlines (
  term_id INTEGER NOT NULL REFERENCES terms(id) ON DELETE CASCADE,
  stage   TEXT    NOT NULL CHECK (stage IN ('proposal', 'chapters_1_3', 'chapters_4_5', 'final')),
  due_on  TEXT    NOT NULL,
  PRIMARY KEY (term_id, stage)
);

-- Existing theses have no term until an admin picks one, so no one is shown as overdue by the upgrade
ALTER TABLE theses ADD COLUMN term_id INTEGER REFERENCES terms(id) ON DELETE SET NULL;

CREATE INDEX idx_theses_term ON theses(term_id);
