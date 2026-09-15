import db from '../db/index.js';

const ENDS_AT = "datetime(sc.starts_at, '+' || sc.duration_minutes || ' minutes')";

const SELECT_SCHEDULE = `
  SELECT sc.*,
    ${ENDS_AT} AS ends_at,
    t.title AS thesis_title, t.student_id, t.adviser_id,
    s.name AS student_name,
    a.name AS adviser_name,
    c.name AS created_by_name,
    (SELECT json_group_array(json_object('id', u.id, 'name', u.name))
       FROM schedule_panelists p
       JOIN users u ON u.id = p.adviser_id
       WHERE p.schedule_id = sc.id) AS panelists_json
  FROM schedules sc
  JOIN theses t ON t.id = sc.thesis_id
  JOIN users s ON s.id = t.student_id
  LEFT JOIN users a ON a.id = t.adviser_id
  LEFT JOIN users c ON c.id = sc.created_by`;

function hydrate(row) {
  if (!row) return row;
  const { panelists_json: panelistsJson, ...schedule } = row;
  return { ...schedule, panelists: JSON.parse(panelistsJson || '[]') };
}

// range: 'upcoming' (scheduled and not yet over), 'past' (finished, completed, or cancelled), or 'all'
export function list({ studentId, adviserId, thesisId, range = 'all', limit } = {}) {
  const where = [];
  const params = [];
  if (studentId) {
    where.push('t.student_id = ?');
    params.push(studentId);
  }
  if (adviserId) {
    // Advisers see events for their advisees and defenses where they sit on the panel
    where.push(
      '(t.adviser_id = ? OR EXISTS (SELECT 1 FROM schedule_panelists p WHERE p.schedule_id = sc.id AND p.adviser_id = ?))',
    );
    params.push(adviserId, adviserId);
  }
  if (thesisId) {
    where.push('sc.thesis_id = ?');
    params.push(thesisId);
  }
  if (range === 'upcoming') where.push(`sc.status = 'scheduled' AND ${ENDS_AT} >= datetime('now')`);
  if (range === 'past') where.push(`(sc.status != 'scheduled' OR ${ENDS_AT} < datetime('now'))`);

  const direction = range === 'past' ? 'DESC' : 'ASC';
  const sql = `${SELECT_SCHEDULE}
    ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
    ORDER BY sc.starts_at ${direction}, sc.id ${direction}
    ${limit ? 'LIMIT ?' : ''}`;
  return db
    .prepare(sql)
    .all(...params, ...(limit ? [limit] : []))
    .map(hydrate);
}

export function findById(id) {
  return hydrate(db.prepare(`${SELECT_SCHEDULE} WHERE sc.id = ?`).get(id));
}

export function create(fields) {
  const result = db
    .prepare(
      `INSERT INTO schedules (thesis_id, type, title, starts_at, duration_minutes, mode, location, notes, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      fields.thesis_id,
      fields.type,
      fields.title,
      fields.starts_at,
      fields.duration_minutes,
      fields.mode,
      fields.location,
      fields.notes,
      fields.created_by,
    );
  return Number(result.lastInsertRowid);
}

const UPDATABLE = ['title', 'starts_at', 'duration_minutes', 'mode', 'location', 'notes', 'status'];

export function update(id, fields) {
  const entries = Object.entries(fields).filter(([key, value]) => UPDATABLE.includes(key) && value !== undefined);
  if (!entries.length) return;
  db.prepare(
    `UPDATE schedules SET ${entries.map(([key]) => `${key} = ?`).join(', ')}, updated_at = datetime('now')
     WHERE id = ?`,
  ).run(...entries.map(([, value]) => value), id);
}

export function setPanelists(scheduleId, adviserIds) {
  db.prepare('DELETE FROM schedule_panelists WHERE schedule_id = ?').run(scheduleId);
  const insert = db.prepare('INSERT INTO schedule_panelists (schedule_id, adviser_id) VALUES (?, ?)');
  for (const adviserId of adviserIds) insert.run(scheduleId, adviserId);
}

export function remove(id) {
  db.prepare('DELETE FROM schedules WHERE id = ?').run(id);
}

// Finds a scheduled event that overlaps the given time and involves the same thesis
// or any of the given advisers (as adviser or panelist)
export function findConflict({ thesisId, adviserIds, startsAt, durationMinutes, excludeId = 0 }) {
  const placeholders = adviserIds.map(() => '?').join(', ');
  const adviserClause = adviserIds.length
    ? `OR t.adviser_id IN (${placeholders})
       OR EXISTS (SELECT 1 FROM schedule_panelists p WHERE p.schedule_id = sc.id AND p.adviser_id IN (${placeholders}))`
    : '';
  const row = db
    .prepare(
      `${SELECT_SCHEDULE}
       WHERE sc.status = 'scheduled' AND sc.id != ?
         AND sc.starts_at < datetime(?, '+' || ? || ' minutes')
         AND ${ENDS_AT} > ?
         AND (sc.thesis_id = ? ${adviserClause})
       LIMIT 1`,
    )
    .get(excludeId, startsAt, durationMinutes, startsAt, thesisId, ...adviserIds, ...adviserIds);
  return hydrate(row);
}
