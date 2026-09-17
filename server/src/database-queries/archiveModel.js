import db from '../database/index.js';
import { MEMBER_NAMES } from './thesisModel.js';

// Completed theses an admin hasn't kept out of the archive. Only public details: no emails, no
// review feedback, and only the final manuscript that was approved.
const ARCHIVED = `
  SELECT * FROM (
    SELECT t.id, t.title, t.abstract, t.keywords,
      ${MEMBER_NAMES} AS student_name,
      (SELECT mu.program FROM thesis_members mm JOIN users mu ON mu.id = mm.student_id
         WHERE mm.thesis_id = t.id AND mm.is_leader = 1) AS student_program,
      a.name AS adviser_name,
      -- Finished when the final manuscript was approved; an admin override has no such date, so
      -- the last update stands in
      COALESCE(
        (SELECT MAX(s.reviewed_at) FROM submission_details s
           WHERE s.thesis_id = t.id AND s.stage = 'final' AND s.status = 'approved'),
        t.updated_at) AS completed_at,
      (SELECT s.id FROM submission_details s
         WHERE s.thesis_id = t.id AND s.stage = 'final' AND s.status = 'approved' AND s.stored_name IS NOT NULL
         ORDER BY s.id DESC LIMIT 1) AS manuscript_id
    FROM theses t
    LEFT JOIN users a ON a.id = t.adviser_id
    WHERE t.status = 'completed' AND t.in_archive = 1
  ) x`;

function filtersToWhere({ search, year } = {}) {
  const where = [];
  const params = [];
  if (search) {
    where.push('(x.title LIKE ? OR x.abstract LIKE ? OR x.keywords LIKE ? OR x.student_name LIKE ?)');
    params.push(...Array(4).fill(`%${search}%`));
  }
  if (year) {
    where.push("strftime('%Y', x.completed_at) = ?");
    params.push(String(year));
  }
  return { sql: where.length ? `WHERE ${where.join(' AND ')}` : '', params };
}

export function list(filters, { limit, offset }) {
  const { sql, params } = filtersToWhere(filters);
  return db
    .prepare(`${ARCHIVED} ${sql} ORDER BY x.completed_at DESC, x.id DESC LIMIT ? OFFSET ?`)
    .all(...params, limit, offset);
}

export function count(filters) {
  const { sql, params } = filtersToWhere(filters);
  return db.prepare(`SELECT COUNT(*) AS n FROM (${ARCHIVED} ${sql})`).get(...params).n;
}

// Years with at least one archived thesis, newest first, for the year filter
export function years() {
  return db
    .prepare(`SELECT DISTINCT strftime('%Y', x.completed_at) AS year FROM (${ARCHIVED}) x ORDER BY year DESC`)
    .all()
    .map((row) => Number(row.year));
}

export function findById(id) {
  return db.prepare(`${ARCHIVED} WHERE x.id = ?`).get(id);
}

export function manuscriptFile(submissionId) {
  return db.prepare('SELECT file_name, stored_name FROM submissions WHERE id = ?').get(submissionId);
}
