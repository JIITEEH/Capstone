import db from '../database/index.js';
import { MEMBER_NAMES } from './thesisModel.js';

const SELECT_INVITATION = `
  SELECT i.id, i.thesis_id, i.student_id, i.invited_by, i.status, i.created_at, i.responded_at,
    t.title AS thesis_title, t.status AS thesis_status,
    ${MEMBER_NAMES} AS group_names,
    s.name AS student_name, s.email AS student_email,
    b.name AS invited_by_name
  FROM group_invitations i
  JOIN theses t ON t.id = i.thesis_id
  JOIN users s ON s.id = i.student_id
  LEFT JOIN users b ON b.id = i.invited_by`;

export function create({ thesisId, studentId, invitedBy }) {
  const result = db
    .prepare('INSERT INTO group_invitations (thesis_id, student_id, invited_by) VALUES (?, ?, ?)')
    .run(thesisId, studentId, invitedBy);
  return findById(Number(result.lastInsertRowid));
}

export function findById(id) {
  return db.prepare(`${SELECT_INVITATION} WHERE i.id = ?`).get(id);
}

// What a student has been invited to and not yet answered
export function listPendingForStudent(studentId) {
  return db.prepare(`${SELECT_INVITATION} WHERE i.student_id = ? AND i.status = 'pending' ORDER BY i.id DESC`).all(studentId);
}

// Who a group has invited and is still waiting on
export function listPendingForThesis(thesisId) {
  return db.prepare(`${SELECT_INVITATION} WHERE i.thesis_id = ? AND i.status = 'pending' ORDER BY i.id`).all(thesisId);
}

export function findPending(thesisId, studentId) {
  return db
    .prepare("SELECT id FROM group_invitations WHERE thesis_id = ? AND student_id = ? AND status = 'pending'")
    .get(thesisId, studentId);
}

export function countPendingForThesis(thesisId) {
  return db.prepare("SELECT COUNT(*) AS n FROM group_invitations WHERE thesis_id = ? AND status = 'pending'").get(thesisId).n;
}

export function setStatus(id, status) {
  db.prepare("UPDATE group_invitations SET status = ?, responded_at = datetime('now') WHERE id = ?").run(status, id);
}

// A student joins one group, so accepting one invitation withdraws the rest
export function cancelOtherPending(studentId, keepId) {
  db.prepare(
    "UPDATE group_invitations SET status = 'cancelled', responded_at = datetime('now') WHERE student_id = ? AND status = 'pending' AND id != ?",
  ).run(studentId, keepId);
}
