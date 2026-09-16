import db from '../database/index.js';
import * as Thesis from './thesisModel.js';

// Everyone taking part in a thesis: its students and its adviser
export function thesisParticipants(thesisId) {
  const thesis = Thesis.findById(thesisId);
  const ids = Thesis.listMembers(thesisId).map((member) => member.id);
  if (thesis?.adviser_id) ids.push(thesis.adviser_id);
  return ids;
}

// Sends one notification to each recipient, skipping the person who caused it: nobody needs to be
// told about their own action. Call inside the same transaction as the change it describes.
export function notify({ recipients, actorId = null, type, title, body = '', link = '' }) {
  const ids = [...new Set(recipients.filter(Boolean))].filter((id) => id !== actorId);
  const insert = db.prepare(
    'INSERT INTO notifications (user_id, actor_id, type, title, body, link) VALUES (?, ?, ?, ?, ?, ?)',
  );
  for (const id of ids) insert.run(id, actorId, type, title, body, link);
  return ids.length;
}

export function listForUser(userId, { limit = 20 } = {}) {
  return db
    .prepare(
      `SELECT n.id, n.type, n.title, n.body, n.link, n.read_at, n.created_at, a.name AS actor_name
       FROM notifications n
       LEFT JOIN users a ON a.id = n.actor_id
       WHERE n.user_id = ?
       ORDER BY n.id DESC
       LIMIT ?`,
    )
    .all(userId, limit);
}

export function unreadCount(userId) {
  return db.prepare('SELECT COUNT(*) AS n FROM notifications WHERE user_id = ? AND read_at IS NULL').get(userId).n;
}

// Scoped to the owner, so nobody can mark someone else's notification as read. Returns whether it matched.
export function markRead(userId, id) {
  const result = db
    .prepare("UPDATE notifications SET read_at = datetime('now') WHERE id = ? AND user_id = ? AND read_at IS NULL")
    .run(id, userId);
  return result.changes > 0 || Boolean(db.prepare('SELECT 1 FROM notifications WHERE id = ? AND user_id = ?').get(id, userId));
}

export function markAllRead(userId) {
  return db
    .prepare("UPDATE notifications SET read_at = datetime('now') WHERE user_id = ? AND read_at IS NULL")
    .run(userId).changes;
}
