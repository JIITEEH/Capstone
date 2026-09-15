import db from '../db/index.js';
import { MEMBER_NAMES } from './thesisModel.js';

export function log(thesisId, actorId, action) {
  db.prepare('INSERT INTO activity (thesis_id, actor_id, action) VALUES (?, ?, ?)').run(thesisId, actorId, action);
}

function scope({ thesisId, adviserId }) {
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
  return { where, params };
}

// Timestamps of recent activity, bucketed by day on the dashboard chart
export function listSince({ thesisId, adviserId, days = 8 } = {}) {
  const { where, params } = scope({ thesisId, adviserId });
  where.push("a.created_at >= datetime('now', ?)");
  params.push(`-${days} days`);
  return db
    .prepare(
      `SELECT a.created_at
       FROM activity a
       JOIN theses t ON t.id = a.thesis_id
       WHERE ${where.join(' AND ')}
       ORDER BY a.created_at`,
    )
    .all(...params)
    .map((row) => row.created_at);
}

export function listRecent({ thesisId, adviserId, limit = 10 } = {}) {
  const { where, params } = scope({ thesisId, adviserId });
  return db
    .prepare(
      `SELECT a.id, a.action, a.created_at, a.thesis_id,
         u.name AS actor_name, u.role AS actor_role,
         t.title AS thesis_title, ${MEMBER_NAMES} AS student_name
       FROM activity a
       JOIN theses t ON t.id = a.thesis_id
       LEFT JOIN users u ON u.id = a.actor_id
       ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
       ORDER BY a.created_at DESC, a.id DESC
       LIMIT ?`,
    )
    .all(...params, limit);
}
