CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  name          TEXT    NOT NULL,
  email         TEXT    NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT    NOT NULL,
  role          TEXT    NOT NULL CHECK (role IN ('student', 'adviser', 'admin')),
  program       TEXT    NOT NULL DEFAULT '',  -- degree program (students) or department (advisers)
  is_active     INTEGER NOT NULL DEFAULT 1,
  created_at    TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- One thesis per student; the adviser is assigned by an admin
CREATE TABLE IF NOT EXISTS theses (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  adviser_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  title      TEXT    NOT NULL,
  abstract   TEXT    NOT NULL DEFAULT '',
  keywords   TEXT    NOT NULL DEFAULT '',
  status     TEXT    NOT NULL DEFAULT 'draft'
             CHECK (status IN ('draft', 'under_review', 'revisions_required', 'in_progress', 'completed')),
  created_at TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- A manuscript uploaded for one stage of the thesis
CREATE TABLE IF NOT EXISTS submissions (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  thesis_id    INTEGER NOT NULL REFERENCES theses(id) ON DELETE CASCADE,
  stage        TEXT    NOT NULL CHECK (stage IN ('proposal', 'chapters_1_3', 'chapters_4_5', 'final')),
  notes        TEXT    NOT NULL DEFAULT '',
  file_name    TEXT,
  stored_name  TEXT,
  file_size    INTEGER,
  mime_type    TEXT,
  status       TEXT    NOT NULL DEFAULT 'pending'
               CHECK (status IN ('pending', 'approved', 'revisions_requested')),
  submitted_at TEXT    NOT NULL DEFAULT (datetime('now')),
  reviewed_at  TEXT,
  reviewed_by  INTEGER REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS comments (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  submission_id INTEGER NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
  author_id     INTEGER REFERENCES users(id) ON DELETE SET NULL,
  body          TEXT    NOT NULL,
  created_at    TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS activity (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  thesis_id  INTEGER NOT NULL REFERENCES theses(id) ON DELETE CASCADE,
  actor_id   INTEGER REFERENCES users(id) ON DELETE SET NULL,
  action     TEXT    NOT NULL,
  created_at TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_theses_adviser      ON theses(adviser_id);
CREATE INDEX IF NOT EXISTS idx_submissions_thesis  ON submissions(thesis_id);
CREATE INDEX IF NOT EXISTS idx_comments_submission ON comments(submission_id);
CREATE INDEX IF NOT EXISTS idx_activity_thesis     ON activity(thesis_id);
