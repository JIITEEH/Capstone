import db from '../db/index.js';

export function create({ submissionId, reviewerId, decision, feedback }) {
  db.prepare('INSERT INTO reviews (submission_id, reviewer_id, decision, feedback) VALUES (?, ?, ?, ?)').run(
    submissionId,
    reviewerId,
    decision,
    feedback,
  );
}

// Reviews plus comments from other people on a student's submissions
const FEEDBACK_FOR_STUDENT = `
  SELECT 'review' AS kind, r.id, r.feedback AS body, r.decision, r.created_at,
    sub.id AS submission_id, sub.stage, u.name AS author_name, u.role AS author_role
  FROM reviews r
  JOIN submissions sub ON sub.id = r.submission_id
  JOIN theses t ON t.id = sub.thesis_id
  LEFT JOIN users u ON u.id = r.reviewer_id
  WHERE t.student_id = ?
  UNION ALL
  SELECT 'comment', c.id, c.body, NULL, c.created_at,
    sub.id, sub.stage, u.name, u.role
  FROM comments c
  JOIN submissions sub ON sub.id = c.submission_id
  JOIN theses t ON t.id = sub.thesis_id
  LEFT JOIN users u ON u.id = c.author_id
  WHERE t.student_id = ? AND (c.author_id IS NULL OR c.author_id != t.student_id)`;

export function recentFeedbackForStudent(studentId, limit = 5) {
  return db
    .prepare(`SELECT * FROM (${FEEDBACK_FOR_STUDENT}) ORDER BY created_at DESC, id DESC LIMIT ?`)
    .all(studentId, studentId, limit);
}

export function countFeedbackForStudent(studentId) {
  return db.prepare(`SELECT COUNT(*) AS count FROM (${FEEDBACK_FOR_STUDENT})`).get(studentId, studentId).count;
}
