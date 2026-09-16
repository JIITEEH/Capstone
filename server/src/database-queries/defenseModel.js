import db from '../database/index.js';
import { DEFENSE_CRITERIA } from '../constants.js';

const CRITERIA = Object.keys(DEFENSE_CRITERIA);

export function listEvaluations(scheduleId) {
  return db
    .prepare(
      `SELECT id, schedule_id, panelist_id, panelist_name, ${CRITERIA.join(', ')}, remarks, created_at, updated_at
       FROM defense_evaluations
       WHERE schedule_id = ?
       ORDER BY panelist_name, id`,
    )
    .all(scheduleId);
}

// A panelist's first save creates their evaluation; later saves replace it
export function saveEvaluation({ scheduleId, panelist, scores, remarks }) {
  db.prepare(
    `INSERT INTO defense_evaluations (schedule_id, panelist_id, panelist_name, ${CRITERIA.join(', ')}, remarks)
     VALUES (?, ?, ?, ${CRITERIA.map(() => '?').join(', ')}, ?)
     ON CONFLICT (schedule_id, panelist_id) DO UPDATE SET
       ${CRITERIA.map((key) => `${key} = excluded.${key}`).join(', ')},
       remarks = excluded.remarks,
       panelist_name = excluded.panelist_name,
       updated_at = datetime('now')`,
  ).run(scheduleId, panelist.id, panelist.name, ...CRITERIA.map((key) => scores[key]), remarks);
}

export function findVerdict(scheduleId) {
  return (
    db
      .prepare(
        `SELECT schedule_id, verdict, notes, recorded_by, recorded_by_name, recorded_at
         FROM defense_verdicts WHERE schedule_id = ?`,
      )
      .get(scheduleId) ?? null
  );
}

export function recordVerdict({ scheduleId, verdict, notes, recordedBy }) {
  db.prepare(
    'INSERT INTO defense_verdicts (schedule_id, verdict, notes, recorded_by, recorded_by_name) VALUES (?, ?, ?, ?, ?)',
  ).run(scheduleId, verdict, notes, recordedBy.id, recordedBy.name);
}

// The average of each criterion across panelists, and the overall average, to two decimal places
export function summarize(evaluations) {
  if (!evaluations.length) return null;
  const round = (n) => Math.round(n * 100) / 100;
  const averages = Object.fromEntries(
    CRITERIA.map((key) => [key, round(evaluations.reduce((sum, e) => sum + e[key], 0) / evaluations.length)]),
  );
  const overall = round(CRITERIA.reduce((sum, key) => sum + averages[key], 0) / CRITERIA.length);
  return { count: evaluations.length, averages, overall };
}
