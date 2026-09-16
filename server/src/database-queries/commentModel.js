import db from '../database/index.js';

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
