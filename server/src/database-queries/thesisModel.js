import db from '../database/index.js';
import { STAGES } from '../constants.js';

// Every group member's name, leader first, for labelling a thesis by its students.
// Expects the theses table to be aliased as t; mm/mu avoid clashing with the outer query's aliases.
export const MEMBER_NAMES = `(SELECT GROUP_CONCAT(mu.name, ', ' ORDER BY mm.is_leader DESC, mm.joined_at, mm.student_id)
     FROM thesis_members mm
     JOIN users mu ON mu.id = mm.student_id
     WHERE mm.thesis_id = t.id)`;

const IS_MEMBER = 'EXISTS (SELECT 1 FROM thesis_members mm WHERE mm.thesis_id = t.id AND mm.student_id = ?)';

const STAGE_ORDER = `CASE d.stage ${Object.keys(STAGES)
  .map((key, index) => `WHEN '${key}' THEN ${index}`)
  .join(' ')} END`;

// The next deadline a group still has to meet: the earliest stage in its term with a due date and
// nothing submitted for it yet. Completed theses have none.
const NEXT_DEADLINE = `term_deadlines nd ON nd.term_id = t.term_id AND t.status != 'completed' AND nd.stage = (
    SELECT d.stage FROM term_deadlines d
    WHERE d.term_id = t.term_id
      AND NOT EXISTS (SELECT 1 FROM submissions s WHERE s.thesis_id = t.id AND s.stage = d.stage)
    ORDER BY ${STAGE_ORDER} LIMIT 1)`;

// A due date is a calendar day, so the deadline passes at the end of that day in the server's time zone
const TODAY = "date('now', 'localtime')";

const SELECT_THESIS = `
  SELECT t.*,
    ${MEMBER_NAMES} AS student_name,
    (SELECT mu.program FROM thesis_members mm JOIN users mu ON mu.id = mm.student_id
       WHERE mm.thesis_id = t.id AND mm.is_leader = 1) AS student_program,
    (SELECT COUNT(*) FROM thesis_members mm WHERE mm.thesis_id = t.id) AS member_count,
    a.name    AS adviser_name,
    a.email   AS adviser_email,
    (SELECT GROUP_CONCAT(DISTINCT x.stage) FROM submission_details x
       WHERE x.thesis_id = t.id AND x.status = 'approved') AS approved_stage_keys,
    (SELECT COUNT(DISTINCT x.stage) FROM submission_details x
       WHERE x.thesis_id = t.id AND x.status = 'approved') AS approved_stages,
    (SELECT COUNT(*) FROM submission_details x WHERE x.thesis_id = t.id AND x.status = 'pending') AS pending_count,
    (SELECT COUNT(*) FROM submission_details x WHERE x.thesis_id = t.id) AS submission_count,
    tm.name   AS term_name,
    nd.stage  AS next_due_stage,
    nd.due_on AS next_due_on,
    CAST(julianday(nd.due_on) - julianday(${TODAY}) AS INTEGER) AS next_due_days_left
  FROM theses t
  LEFT JOIN users a ON a.id = t.adviser_id
  LEFT JOIN terms tm ON tm.id = t.term_id
  LEFT JOIN ${NEXT_DEADLINE}`;

function filtersToWhere({ studentId, adviserId, unassigned, status, search, termId, overdue } = {}) {
  const where = [];
  const params = [];
  if (studentId) {
    where.push(IS_MEMBER);
    params.push(studentId);
  }
  if (adviserId) {
    where.push('t.adviser_id = ?');
    params.push(adviserId);
  }
  if (unassigned) where.push('t.adviser_id IS NULL');
  if (status) {
    where.push('t.status = ?');
    params.push(status);
  }
  if (termId === 'none') where.push('t.term_id IS NULL');
  else if (termId) {
    where.push('t.term_id = ?');
    params.push(termId);
  }
  if (overdue) where.push(`nd.due_on < ${TODAY}`);
  if (search) {
    where.push(`(t.title LIKE ? OR t.keywords LIKE ? OR EXISTS (
      SELECT 1 FROM thesis_members mm JOIN users mu ON mu.id = mm.student_id
      WHERE mm.thesis_id = t.id AND mu.name LIKE ?))`);
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }
  return { sql: where.length ? `WHERE ${where.join(' AND ')}` : '', params };
}

// Pass `limit` and `offset` for one page; leave them out for every matching thesis
export function list(filters = {}, { limit, offset = 0 } = {}) {
  const { sql, params } = filtersToWhere(filters);
  const page = limit ? 'LIMIT ? OFFSET ?' : '';
  return db
    .prepare(`${SELECT_THESIS} ${sql} ORDER BY t.updated_at DESC, t.id DESC ${page}`)
    .all(...params, ...(limit ? [limit, offset] : []));
}

export function count(filters = {}) {
  const { sql, params } = filtersToWhere(filters);
  // The deadline join is only here because the overdue filter reads it
  return db.prepare(`SELECT COUNT(*) AS n FROM theses t LEFT JOIN ${NEXT_DEADLINE} ${sql}`).get(...params).n;
}

export function findById(id) {
  return db.prepare(`${SELECT_THESIS} WHERE t.id = ?`).get(id);
}

// The thesis a student belongs to, if any
export function findByStudent(studentId) {
  return db.prepare(`${SELECT_THESIS} WHERE ${IS_MEMBER}`).get(studentId);
}

// The creating student becomes the group leader. Callers run this in a transaction
// so a thesis never exists without its leader.
export function create({ studentId, title, abstract, keywords, termId = null }) {
  const result = db
    .prepare('INSERT INTO theses (title, abstract, keywords, term_id) VALUES (?, ?, ?, ?)')
    .run(title, abstract, keywords, termId);
  db.prepare('INSERT INTO thesis_members (thesis_id, student_id, is_leader) VALUES (?, ?, 1)').run(
    result.lastInsertRowid,
    studentId,
  );
  return findById(result.lastInsertRowid);
}

const UPDATABLE = ['title', 'abstract', 'keywords', 'adviser_id', 'status', 'term_id', 'in_archive'];

export function update(id, fields) {
  const entries = Object.entries(fields).filter(([key, value]) => UPDATABLE.includes(key) && value !== undefined);
  if (entries.length) {
    db.prepare(
      `UPDATE theses SET ${entries.map(([key]) => `${key} = ?`).join(', ')}, updated_at = datetime('now')
       WHERE id = ?`,
    ).run(...entries.map(([, value]) => value), id);
  }
  return findById(id);
}

export function remove(id) {
  db.prepare('DELETE FROM theses WHERE id = ?').run(id);
}

export function listMembers(thesisId) {
  return db
    .prepare(
      `SELECT u.id, u.name, u.email, u.program, m.is_leader, m.joined_at
       FROM thesis_members m
       JOIN users u ON u.id = m.student_id
       WHERE m.thesis_id = ?
       ORDER BY m.is_leader DESC, m.joined_at, m.student_id`,
    )
    .all(thesisId);
}

export function isMember(thesisId, studentId) {
  return Boolean(
    db.prepare('SELECT 1 FROM thesis_members WHERE thesis_id = ? AND student_id = ?').get(thesisId, studentId),
  );
}

export function isLeader(thesisId, studentId) {
  return Boolean(
    db
      .prepare('SELECT 1 FROM thesis_members WHERE thesis_id = ? AND student_id = ? AND is_leader = 1')
      .get(thesisId, studentId),
  );
}

export function addMember(thesisId, studentId) {
  db.prepare('INSERT INTO thesis_members (thesis_id, student_id) VALUES (?, ?)').run(thesisId, studentId);
}

// If the leader is removed, the longest-standing remaining member takes over.
// Callers run this in a transaction.
export function removeMember(thesisId, studentId) {
  const member = db
    .prepare('SELECT is_leader FROM thesis_members WHERE thesis_id = ? AND student_id = ?')
    .get(thesisId, studentId);
  if (!member) return;

  db.prepare('DELETE FROM thesis_members WHERE thesis_id = ? AND student_id = ?').run(thesisId, studentId);
  if (member.is_leader) {
    db.prepare(
      `UPDATE thesis_members SET is_leader = 1
       WHERE thesis_id = ? AND student_id = (
         SELECT student_id FROM thesis_members WHERE thesis_id = ? ORDER BY joined_at, student_id LIMIT 1
       )`,
    ).run(thesisId, thesisId);
  }
}

// Derive the thesis status from its submissions. Called after every submission or review.
export function recomputeStatus(thesisId) {
  const row = db
    .prepare(
      `SELECT
         EXISTS (SELECT 1 FROM submission_details WHERE thesis_id = ? AND stage = 'final' AND status = 'approved') AS final_approved,
         EXISTS (SELECT 1 FROM submission_details WHERE thesis_id = ? AND status = 'pending') AS has_pending,
         (SELECT status FROM submission_details WHERE thesis_id = ? AND status != 'pending'
            ORDER BY reviewed_at DESC, id DESC LIMIT 1) AS last_decision`,
    )
    .get(thesisId, thesisId, thesisId);

  let status = 'draft';
  if (row.final_approved) status = 'completed';
  else if (row.has_pending) status = 'under_review';
  else if (row.last_decision === 'revisions_requested') status = 'revisions_required';
  else if (row.last_decision === 'approved') status = 'in_progress';

  db.prepare("UPDATE theses SET status = ?, updated_at = datetime('now') WHERE id = ?").run(status, thesisId);
  return status;
}
