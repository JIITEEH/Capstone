import { createHash, randomBytes } from 'node:crypto';
import db, { transaction } from '../db/index.js';
import * as User from './userModel.js';

const TOKEN_TTL_MINUTES = 60;

// Only a hash is stored, so a leaked database can't be used to reset passwords
const hashToken = (token) => createHash('sha256').update(token).digest('hex');

// Issues a new reset token for the user; any earlier link stops working
export function create(userId) {
  const token = randomBytes(32).toString('base64url');
  transaction(() => {
    db.prepare('DELETE FROM password_resets WHERE user_id = ?').run(userId);
    db.prepare(
      "INSERT INTO password_resets (user_id, token_hash, expires_at) VALUES (?, ?, datetime('now', ?))",
    ).run(userId, hashToken(token), `+${TOKEN_TTL_MINUTES} minutes`);
  });
  return token;
}

// Sets the new password if the token is valid and unexpired. Returns false otherwise.
export function consume(token, password) {
  return transaction(() => {
    const row = db
      .prepare(
        `SELECT r.user_id FROM password_resets r
         JOIN users u ON u.id = r.user_id
         WHERE r.token_hash = ? AND r.expires_at > datetime('now') AND u.is_active = 1`,
      )
      .get(hashToken(token));
    if (!row) return false;

    User.setPassword(row.user_id, password);
    db.prepare('DELETE FROM password_resets WHERE user_id = ?').run(row.user_id);
    return true;
  });
}
