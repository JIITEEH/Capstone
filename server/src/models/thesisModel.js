import db from '../db/index.js';

const SELECT_THESIS = `
  SELECT t.*,
    s.name    AS student_name,
    s.email   AS student_email,
    s.program AS student_program,
    a.name    AS adviser_name,
    a.email   AS adviser_email,
    (SELECT GROUP_CONCAT(DISTINCT x.stage) FROM submission_details x
       WHERE x.thesis_id = t.id AND x.status = 'approved') AS approved_stage_keys,
    (SELECT COUNT(DISTINCT x.stage) FROM submission_details x
       WHERE x.thesis_id = t.id AND x.status = 'approved') AS approved_stages,
    (SELECT COUNT(*) FROM submission_details x WHERE x.thesis_id = t.id AND x.status = 'pending') AS pending_count,
    (SELECT COUNT(*) FROM submission_details x WHERE x.thesis_id = t.id) AS submission_count
  FROM theses t
  JOIN users s ON s.id = t.student_id
  LEFT JOIN users a ON a.id = t.adviser_id`;

export function list({ studentId, adviserId, unassigned, status, search } = {}) {
  const where = [];
  const params = [];
  if (studentId) {
    where.push('t.student_id = ?');
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
  if (search) {
    where.push('(t.title LIKE ? OR t.keywords LIKE ? OR s.name LIKE ?)');
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }
  return db
    .prepare(
      `${SELECT_THESIS} ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
       ORDER BY t.updated_at DESC, t.id DESC`,
    )
    .all(...params);
}

export function findById(id) {
  return db.prepare(`${SELECT_THESIS} WHERE t.id = ?`).get(id);
}

export function findByStudent(studentId) {
  return db.prepare(`${SELECT_THESIS} WHERE t.student_id = ?`).get(studentId);
}

export function create({ studentId, title, abstract, keywords }) {
  const result = db
    .prepare('INSERT INTO theses (student_id, title, abstract, keywords) VALUES (?, ?, ?, ?)')
    .run(studentId, title, abstract, keywords);
  return findById(result.lastInsertRowid);
}

const UPDATABLE = ['title', 'abstract', 'keywords', 'adviser_id', 'status'];

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
