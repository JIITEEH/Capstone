import db from '../db/index.js';

export function overview() {
  return db
    .prepare(
      `SELECT
         (SELECT COUNT(*) FROM users WHERE role = 'student') AS students,
         (SELECT COUNT(*) FROM users WHERE role = 'adviser') AS advisers,
         (SELECT COUNT(*) FROM theses) AS theses,
         (SELECT COUNT(*) FROM theses WHERE adviser_id IS NULL) AS unassigned,
         (SELECT COUNT(*) FROM submissions WHERE status = 'pending') AS pending_reviews,
         (SELECT COUNT(*) FROM theses WHERE status = 'completed') AS completed`,
    )
    .get();
}

export function statusBreakdown() {
  return db.prepare('SELECT status, COUNT(*) AS count FROM theses GROUP BY status').all();
}
