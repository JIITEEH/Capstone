import db from '../db/index.js';

export function log(thesisId, actorId, action) {
  db.prepare('INSERT INTO activity (thesis_id, actor_id, action) VALUES (?, ?, ?)').run(thesisId, actorId, action);
}

export function listRecent({ thesisId, adviserId, limit = 10 } = {}) {
  const where = [];
  const params = [];
  if (thesisId) {
    where.push('a.thesis_id = ?');
    params.push(thesisId);
  }
  if (adviserId) {
    where.push('t.adviser_id = ?');
    params.push(adviserId);
  }
  return db
    .prepare(
      `SELECT a.id, a.action, a.created_at, a.thesis_id,
         u.name AS actor_name, u.role AS actor_role,
         t.title AS thesis_title, s.name AS student_name
       FROM activity a
       JOIN theses t ON t.id = a.thesis_id
       JOIN users s ON s.id = t.student_id
       LEFT JOIN users u ON u.id = a.actor_id
       ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
       ORDER BY a.created_at DESC, a.id DESC
       LIMIT ?`,
    )
    .all(...params, limit);
}
