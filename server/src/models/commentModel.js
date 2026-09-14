import db from '../db/index.js';

const SELECT_COMMENT = `
  SELECT c.*, u.name AS author_name, u.role AS author_role
  FROM comments c
  LEFT JOIN users u ON u.id = c.author_id`;

export function listBySubmission(submissionId) {
  return db
    .prepare(`${SELECT_COMMENT} WHERE c.submission_id = ? ORDER BY c.created_at ASC, c.id ASC`)
    .all(submissionId);
}

export function create({ submissionId, authorId, body }) {
  const result = db
    .prepare('INSERT INTO comments (submission_id, author_id, body) VALUES (?, ?, ?)')
    .run(submissionId, authorId, body);
  return db.prepare(`${SELECT_COMMENT} WHERE c.id = ?`).get(result.lastInsertRowid);
}

// Feedback left by other people on a student's submissions
const FEEDBACK_FOR_STUDENT = `
  FROM comments c
  JOIN submissions sub ON sub.id = c.submission_id
  JOIN theses t ON t.id = sub.thesis_id
  LEFT JOIN users u ON u.id = c.author_id
  WHERE t.student_id = ? AND (c.author_id IS NULL OR c.author_id != t.student_id)`;

export function recentForStudent(studentId, limit = 5) {
  return db
    .prepare(
      `SELECT c.id, c.body, c.created_at, c.submission_id, sub.stage,
         u.name AS author_name, u.role AS author_role
       ${FEEDBACK_FOR_STUDENT}
       ORDER BY c.created_at DESC, c.id DESC LIMIT ?`,
    )
    .all(studentId, limit);
}

export function countForStudent(studentId) {
  return db.prepare(`SELECT COUNT(*) AS count ${FEEDBACK_FOR_STUDENT}`).get(studentId).count;
}
