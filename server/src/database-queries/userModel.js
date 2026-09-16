import db from '../database/index.js';
import { hashPassword } from '../helpers/password.js';

const PUBLIC_COLUMNS = 'u.id, u.name, u.email, u.role, u.program, u.is_active, u.created_at';

export function findById(id) {
  return db.prepare(`SELECT ${PUBLIC_COLUMNS} FROM users u WHERE u.id = ?`).get(id);
}

export function findByEmailWithHash(email) {
  return db.prepare('SELECT * FROM users WHERE email = ?').get(email);
}

export function emailTaken(email, excludeId = 0) {
  return Boolean(db.prepare('SELECT 1 FROM users WHERE email = ? AND id != ?').get(email, excludeId));
}

export function list({ role, search } = {}) {
  const where = [];
  const params = [];
  if (role) {
    where.push('u.role = ?');
    params.push(role);
  }
  if (search) {
    where.push('(u.name LIKE ? OR u.email LIKE ?)');
    params.push(`%${search}%`, `%${search}%`);
  }
  return db
    .prepare(
      `SELECT ${PUBLIC_COLUMNS},
         (SELECT COUNT(*) FROM theses t WHERE t.adviser_id = u.id) AS advisee_count,
         EXISTS (SELECT 1 FROM thesis_members m WHERE m.student_id = u.id) AS has_thesis
       FROM users u
       ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
       ORDER BY u.created_at DESC, u.id DESC`,
    )
    .all(...params);
}

export function listAdvisers() {
  return db
    .prepare(
      `SELECT ${PUBLIC_COLUMNS},
         (SELECT COUNT(*) FROM theses t WHERE t.adviser_id = u.id) AS advisee_count,
         (SELECT COUNT(*) FROM submission_details s JOIN theses t ON t.id = s.thesis_id
            WHERE t.adviser_id = u.id AND s.status = 'pending') AS pending_count
       FROM users u
       WHERE u.role = 'adviser' AND u.is_active = 1
       ORDER BY u.name`,
    )
    .all();
}

export function create({ name, email, password, role, program = '' }) {
  const result = db
    .prepare('INSERT INTO users (name, email, password_hash, role, program) VALUES (?, ?, ?, ?, ?)')
    .run(name, email, hashPassword(password), role, program);
  return findById(result.lastInsertRowid);
}

const UPDATABLE = ['name', 'email', 'role', 'program', 'is_active'];

export function update(id, fields) {
  const entries = Object.entries(fields).filter(([key, value]) => UPDATABLE.includes(key) && value !== undefined);
  if (entries.length) {
    db.prepare(`UPDATE users SET ${entries.map(([key]) => `${key} = ?`).join(', ')} WHERE id = ?`).run(
      ...entries.map(([, value]) => value),
      id,
    );
  }
  return findById(id);
}

export function setPassword(id, password) {
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hashPassword(password), id);
}

export function remove(id) {
  db.prepare('DELETE FROM users WHERE id = ?').run(id);
}
