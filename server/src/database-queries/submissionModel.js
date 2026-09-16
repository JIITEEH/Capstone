import db from '../database/index.js';
import { MEMBER_NAMES } from './thesisModel.js';

// submission_details (see db/migrations/004_baseline.sql) adds status and review columns from reviews
const SELECT_SUBMISSION = `
  SELECT sub.id, sub.thesis_id, sub.stage, sub.notes, sub.file_name, sub.file_size, sub.mime_type,
    sub.submitted_at, sub.status, sub.reviewer_id, sub.review_feedback, sub.reviewed_at,
    (sub.stored_name IS NOT NULL) AS has_file,
    r.name AS reviewer_name,
    (SELECT COUNT(*) FROM comments c WHERE c.submission_id = sub.id) AS comment_count
  FROM submission_details sub
  LEFT JOIN users r ON r.id = sub.reviewer_id`;

export function listByThesis(thesisId) {
  return db
    .prepare(`${SELECT_SUBMISSION} WHERE sub.thesis_id = ? ORDER BY sub.submitted_at DESC, sub.id DESC`)
    .all(thesisId);
}

export function findById(id) {
  return db.prepare(`${SELECT_SUBMISSION} WHERE sub.id = ?`).get(id);
}

// Which attempt this is at its stage: the first upload is version 1, a resubmission is version 2,
// and so on. Counting by submitted_at means the numbers never shift when an older one is reviewed.
export function versionInfo(id) {
  return db
    .prepare(
      `WITH numbered AS (
         SELECT id, thesis_id, stage,
           ROW_NUMBER() OVER (PARTITION BY thesis_id, stage ORDER BY submitted_at, id) AS version,
           COUNT(*)     OVER (PARTITION BY thesis_id, stage) AS total
         FROM submissions
       )
       SELECT version, total FROM numbered WHERE id = ?`,
    )
    .get(id);
}

// The submission this one replaces: the previous attempt at the same stage, with the feedback that
// prompted the resubmission. Returns null for a first attempt.
export function findPreviousVersion(id) {
  return db
    .prepare(
      `SELECT prev.id, prev.file_name, prev.submitted_at, prev.status, prev.review_feedback, prev.reviewed_at,
         r.name AS reviewer_name
       FROM submission_details sub
       JOIN submission_details prev
         ON prev.thesis_id = sub.thesis_id
        AND prev.stage = sub.stage
        AND (prev.submitted_at, prev.id) < (sub.submitted_at, sub.id)
       LEFT JOIN users r ON r.id = prev.reviewer_id
       WHERE sub.id = ?
       ORDER BY prev.submitted_at DESC, prev.id DESC
       LIMIT 1`,
    )
    .get(id);
}

export function getStoredName(id) {
  return db.prepare('SELECT stored_name FROM submissions WHERE id = ?').get(id)?.stored_name ?? null;
}

export function storedNamesForThesis(thesisId) {
  return db
    .prepare('SELECT stored_name FROM submissions WHERE thesis_id = ? AND stored_name IS NOT NULL')
    .all(thesisId)
    .map((row) => row.stored_name);
}

export function create({ thesisId, stage, notes, file }) {
  const result = db
    .prepare(
      `INSERT INTO submissions (thesis_id, stage, notes, file_name, stored_name, file_size, mime_type)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(thesisId, stage, notes, file.originalname, file.filename, file.size, file.mimetype);
  return findById(result.lastInsertRowid);
}

export function hasPending(thesisId) {
  return Boolean(
    db.prepare("SELECT 1 FROM submission_details WHERE thesis_id = ? AND status = 'pending'").get(thesisId),
  );
}

export function isStageApproved(thesisId, stage) {
  return Boolean(
    db
      .prepare("SELECT 1 FROM submission_details WHERE thesis_id = ? AND stage = ? AND status = 'approved'")
      .get(thesisId, stage),
  );
}

export function listPending({ adviserId } = {}) {
  return db
    .prepare(
      `SELECT sub.id, sub.stage, sub.submitted_at, sub.thesis_id,
         t.title AS thesis_title, ${MEMBER_NAMES} AS student_name
       FROM submission_details sub
       JOIN theses t ON t.id = sub.thesis_id
       WHERE sub.status = 'pending' ${adviserId ? 'AND t.adviser_id = ?' : ''}
       ORDER BY sub.submitted_at ASC`,
    )
    .all(...(adviserId ? [adviserId] : []));
}
