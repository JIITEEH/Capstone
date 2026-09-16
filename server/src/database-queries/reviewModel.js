import db from '../database/index.js';

export function create({ submissionId, reviewerId, decision, feedback }) {
  db.prepare('INSERT INTO reviews (submission_id, reviewer_id, decision, feedback) VALUES (?, ?, ?, ?)').run(
    submissionId,
    reviewerId,
    decision,
    feedback,
  );
}

// Reviews plus comments from people outside the group on the submissions of a student's thesis
const FEEDBACK_FOR_STUDENT = `
  SELECT 'review' AS kind, r.id, r.feedback AS body, r.decision, r.created_at,
    sub.id AS submission_id, sub.stage, u.name AS author_name, u.role AS author_role
  FROM reviews r
  JOIN submissions sub ON sub.id = r.submission_id
  JOIN theses t ON t.id = sub.thesis_id
  LEFT JOIN users u ON u.id = r.reviewer_id
  WHERE t.id = (SELECT thesis_id FROM thesis_members WHERE student_id = ?)
  UNION ALL
  SELECT 'comment', c.id, c.body, NULL, c.created_at,
    sub.id, sub.stage, u.name, u.role
  FROM comments c
  JOIN submissions sub ON sub.id = c.submission_id
  JOIN theses t ON t.id = sub.thesis_id
  LEFT JOIN users u ON u.id = c.author_id
  WHERE t.id = (SELECT thesis_id FROM thesis_members WHERE student_id = ?)
    AND (c.author_id IS NULL OR c.author_id NOT IN (SELECT student_id FROM thesis_members WHERE thesis_id = t.id))`;

export function recentFeedbackForStudent(studentId, limit = 5) {
  return db
    .prepare(`SELECT * FROM (${FEEDBACK_FOR_STUDENT}) ORDER BY created_at DESC, id DESC LIMIT ?`)
    .all(studentId, studentId, limit);
}

export function countFeedbackForStudent(studentId) {
  return db.prepare(`SELECT COUNT(*) AS count FROM (${FEEDBACK_FOR_STUDENT})`).get(studentId, studentId).count;
}
