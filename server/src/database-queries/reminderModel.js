import db from '../database/index.js';
import { NEXT_DEADLINE } from './thesisModel.js';

// A group is reminded this many days before its next due date
export const DUE_SOON_DAYS = 3;

// An overdue reminder is only sent this soon after the date passes. A job that was switched off for
// weeks, or a first run after upgrading, then doesn't remind groups about long-missed deadlines.
export const OVERDUE_WINDOW_DAYS = 7;

// Reminders owed today: each unfinished thesis whose next deadline (the same one the rest of the app
// shows) is due within DUE_SOON_DAYS or passed within OVERDUE_WINDOW_DAYS, and that hasn't already been
// sent that kind of reminder for that date. `today` is YYYY-MM-DD; it defaults to the server's today.
export function owed(today = null) {
  return db
    .prepare(
      `SELECT * FROM (
         SELECT t.id AS thesis_id, t.title, nd.stage, nd.due_on,
           CAST(julianday(nd.due_on) - julianday(COALESCE(:today, date('now', 'localtime'))) AS INTEGER) AS days_left
         FROM theses t
         JOIN ${NEXT_DEADLINE}
       ) r
       WHERE r.days_left BETWEEN -:overdueWindow AND :dueSoon
         AND NOT EXISTS (
           SELECT 1 FROM deadline_reminders dr
           WHERE dr.thesis_id = r.thesis_id AND dr.stage = r.stage AND dr.due_on = r.due_on
             AND dr.kind = CASE WHEN r.days_left < 0 THEN 'overdue' ELSE 'due_soon' END)
       ORDER BY r.due_on, r.thesis_id`,
    )
    .all({ today, dueSoon: DUE_SOON_DAYS, overdueWindow: OVERDUE_WINDOW_DAYS })
    .map((row) => ({ ...row, kind: row.days_left < 0 ? 'overdue' : 'due_soon' }));
}

// Claims a reminder before it is sent. Returns false if it was already recorded, for example by
// another run at the same moment, so the caller skips it.
export function record({ thesisId, stage, dueOn, kind }) {
  const result = db
    .prepare('INSERT OR IGNORE INTO deadline_reminders (thesis_id, stage, due_on, kind) VALUES (?, ?, ?, ?)')
    .run(thesisId, stage, dueOn, kind);
  return result.changes > 0;
}
