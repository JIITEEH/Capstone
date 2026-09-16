import db from '../database/index.js';
import { STAGES } from '../constants.js';

const STAGE_KEYS = Object.keys(STAGES);

const SELECT_TERM = `
  SELECT tm.*, (SELECT COUNT(*) FROM theses t WHERE t.term_id = tm.id) AS thesis_count
  FROM terms tm`;

// Attaches { proposal: '2026-10-01', ... } to each term; stages without a due date are left out
function withDeadlines(term) {
  if (!term) return term;
  const rows = db.prepare('SELECT stage, due_on FROM term_deadlines WHERE term_id = ?').all(term.id);
  const byStage = Object.fromEntries(rows.map((row) => [row.stage, row.due_on]));
  return { ...term, deadlines: Object.fromEntries(STAGE_KEYS.filter((key) => byStage[key]).map((key) => [key, byStage[key]])) };
}

export function list() {
  return db.prepare(`${SELECT_TERM} ORDER BY tm.starts_on DESC, tm.id DESC`).all().map(withDeadlines);
}

export function findById(id) {
  return withDeadlines(db.prepare(`${SELECT_TERM} WHERE tm.id = ?`).get(id));
}

export function findByName(name) {
  return db.prepare('SELECT id FROM terms WHERE name = ?').get(name);
}

export function findCurrent() {
  return db.prepare('SELECT id FROM terms WHERE is_current = 1').get();
}

// Callers run the write functions below in a transaction, so a term and its deadlines change together
export function create({ name, startsOn, endsOn }) {
  const result = db.prepare('INSERT INTO terms (name, starts_on, ends_on) VALUES (?, ?, ?)').run(name, startsOn, endsOn);
  return Number(result.lastInsertRowid);
}

export function update(id, { name, startsOn, endsOn }) {
  db.prepare('UPDATE terms SET name = ?, starts_on = ?, ends_on = ? WHERE id = ?').run(name, startsOn, endsOn, id);
}

export function setDeadlines(id, deadlines) {
  db.prepare('DELETE FROM term_deadlines WHERE term_id = ?').run(id);
  const insert = db.prepare('INSERT INTO term_deadlines (term_id, stage, due_on) VALUES (?, ?, ?)');
  for (const stage of STAGE_KEYS) {
    if (deadlines[stage]) insert.run(id, stage, deadlines[stage]);
  }
}

export function makeCurrent(id) {
  db.prepare('UPDATE terms SET is_current = 0 WHERE is_current = 1').run();
  db.prepare('UPDATE terms SET is_current = 1 WHERE id = ?').run(id);
}

export function remove(id) {
  db.prepare('DELETE FROM terms WHERE id = ?').run(id);
}

// How a thesis did against each deadline in its term, in stage order. `state` is one of:
// met (first submitted on or before the due date), late (first submitted after it),
// missed (nothing submitted and the day has passed), or upcoming.
export function deadlinesForThesis(thesisId) {
  const rows = db
    .prepare(
      `SELECT d.stage, d.due_on,
         (SELECT MIN(date(s.submitted_at, 'localtime')) FROM submissions s
            WHERE s.thesis_id = t.id AND s.stage = d.stage) AS first_submitted_on,
         CAST(julianday(d.due_on) - julianday(date('now', 'localtime')) AS INTEGER) AS days_left
       FROM theses t
       JOIN term_deadlines d ON d.term_id = t.term_id
       WHERE t.id = ?`,
    )
    .all(thesisId);

  return rows
    .map((row) => {
      let state = 'upcoming';
      if (row.first_submitted_on) state = row.first_submitted_on <= row.due_on ? 'met' : 'late';
      else if (row.days_left < 0) state = 'missed';
      return { ...row, label: STAGES[row.stage], state };
    })
    .sort((a, b) => STAGE_KEYS.indexOf(a.stage) - STAGE_KEYS.indexOf(b.stage));
}
