import db from '../database/index.js';

// Call inside the same transaction as the change it describes, so the two always land together
export function record({ actor, action, targetType, targetId = null, targetLabel = '', details = '' }) {
  db.prepare(
    `INSERT INTO audit_log (actor_id, actor_name, action, target_type, target_id, target_label, details)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(actor?.id ?? null, actor?.name ?? 'System', action, targetType, targetId, targetLabel, details);
}

// Newest first. Pass the id of the oldest entry already shown as `before` to get the next page.
export function list({ limit = 50, before, targetType } = {}) {
  const where = [];
  const params = [];
  if (before) {
    where.push('id < ?');
    params.push(before);
  }
  if (targetType) {
    where.push('target_type = ?');
    params.push(targetType);
  }

  // One extra row tells us whether an older page exists, without a second COUNT query
  const rows = db
    .prepare(
      `SELECT id, actor_id, actor_name, action, target_type, target_id, target_label, details, created_at
       FROM audit_log
       ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
       ORDER BY id DESC
       LIMIT ?`,
    )
    .all(...params, limit + 1);

  const entries = rows.slice(0, limit);
  return { entries, nextBefore: rows.length > limit ? entries.at(-1).id : null };
}
