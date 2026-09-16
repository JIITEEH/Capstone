import db from '../database/index.js';
import { STAGES } from '../constants.js';
import { MEMBER_NAMES } from './thesisModel.js';

// The theses a user may open, as a condition on the theses table aliased as t.
// Mirrors canViewThesis in permission-rules/access.js.
function thesisScope(user) {
  if (user.role === 'admin') return { sql: '1 = 1', params: [] };
  if (user.role === 'adviser') return { sql: 't.adviser_id = ?', params: [user.id] };
  return {
    sql: 'EXISTS (SELECT 1 FROM thesis_members sm WHERE sm.thesis_id = t.id AND sm.student_id = ?)',
    params: [user.id],
  };
}

// Matches the term anywhere, treating % and _ as ordinary characters. Pair with ESCAPE '\'.
function contains(term) {
  return `%${term.replace(/[\\%_]/g, '\\$&')}%`;
}

// Stage keys whose label contains the term. Hyphens and en dashes count as the same character,
// so "chapters 1-3" finds "Chapters 1–3".
function matchingStages(term) {
  const normalize = (text) => text.toLowerCase().replace(/–/g, '-');
  const wanted = normalize(term);
  return Object.entries(STAGES)
    .filter(([, label]) => normalize(label).includes(wanted))
    .map(([key]) => key);
}

export function theses(user, term, limit) {
  const scope = thesisScope(user);
  const like = contains(term);
  return db
    .prepare(
      `SELECT t.id, t.title, t.status, ${MEMBER_NAMES} AS student_name
       FROM theses t
       WHERE ${scope.sql}
         AND (t.title LIKE ? ESCAPE '\\' OR t.keywords LIKE ? ESCAPE '\\' OR EXISTS (
           SELECT 1 FROM thesis_members m JOIN users u ON u.id = m.student_id
           WHERE m.thesis_id = t.id AND u.name LIKE ? ESCAPE '\\'))
       ORDER BY t.updated_at DESC, t.id DESC
       LIMIT ?`,
    )
    .all(...scope.params, like, like, like, limit);
}

// Admins find anyone. Everyone else finds only the people on theses they can see:
// advisers find their advisees, students find their group and their adviser.
export function people(user, term, limit) {
  const like = contains(term);
  const match = "(u.name LIKE ? ESCAPE '\\' OR u.email LIKE ? ESCAPE '\\')";

  if (user.role === 'admin') {
    return db
      .prepare(
        `SELECT u.id, u.name, u.email, u.role, u.program, u.is_active,
           (SELECT m.thesis_id FROM thesis_members m WHERE m.student_id = u.id) AS thesis_id
         FROM users u
         WHERE ${match}
         ORDER BY u.name, u.id
         LIMIT ?`,
      )
      .all(like, like, limit);
  }

  const scope = thesisScope(user);
  return db
    .prepare(
      `SELECT u.id, u.name, u.email, u.role, u.program, u.is_active, t.id AS thesis_id
       FROM theses t
       JOIN users u ON u.id = t.adviser_id
         OR EXISTS (SELECT 1 FROM thesis_members m WHERE m.thesis_id = t.id AND m.student_id = u.id)
       WHERE ${scope.sql} AND u.id != ? AND ${match}
       GROUP BY u.id
       ORDER BY u.name, u.id
       LIMIT ?`,
    )
    .all(...scope.params, user.id, like, like, limit);
}

// Finds submissions by file name, notes, stage, or the thesis and students they belong to
export function submissions(user, term, limit) {
  const scope = thesisScope(user);
  const like = contains(term);
  const stages = matchingStages(term);
  const stageMatch = stages.length ? ` OR sub.stage IN (${stages.map(() => '?').join(', ')})` : '';
  return db
    .prepare(
      `SELECT sub.id, sub.thesis_id, sub.stage, sub.file_name, sub.status, sub.submitted_at,
         t.title AS thesis_title, ${MEMBER_NAMES} AS student_name
       FROM submission_details sub
       JOIN theses t ON t.id = sub.thesis_id
       WHERE ${scope.sql}
         AND (sub.file_name LIKE ? ESCAPE '\\' OR sub.notes LIKE ? ESCAPE '\\' OR t.title LIKE ? ESCAPE '\\'
           OR EXISTS (SELECT 1 FROM thesis_members m JOIN users u ON u.id = m.student_id
             WHERE m.thesis_id = t.id AND u.name LIKE ? ESCAPE '\\')${stageMatch})
       ORDER BY sub.submitted_at DESC, sub.id DESC
       LIMIT ?`,
    )
    .all(...scope.params, like, like, like, like, ...stages, limit);
}
