import { createHash, randomBytes } from 'node:crypto';
import db, { transaction } from '../database/index.js';

const TOKEN_TTL_HOURS = 48;

// Only a hash is stored, so a leaked database can't be used to verify someone else's address
const hashToken = (token) => createHash('sha256').update(token).digest('hex');

// Issues a fresh link for the user; any earlier link stops working
export function create(userId) {
  const token = randomBytes(32).toString('base64url');
  transaction(() => {
    db.prepare('DELETE FROM email_verifications WHERE user_id = ?').run(userId);
    db.prepare(
      "INSERT INTO email_verifications (user_id, token_hash, expires_at) VALUES (?, ?, datetime('now', ?))",
    ).run(userId, hashToken(token), `+${TOKEN_TTL_HOURS} hours`);
  });
  return token;
}

// Marks the address verified if the link is valid and unexpired. Returns the user id, or null.
export function consume(token) {
  return transaction(() => {
    const row = db
      .prepare("SELECT user_id FROM email_verifications WHERE token_hash = ? AND expires_at > datetime('now')")
      .get(hashToken(token));
    if (!row) return null;

    db.prepare("UPDATE users SET email_verified_at = datetime('now') WHERE id = ? AND email_verified_at IS NULL").run(
      row.user_id,
    );
    db.prepare('DELETE FROM email_verifications WHERE user_id = ?').run(row.user_id);
    return row.user_id;
  });
}

export const LINK_LIFETIME_HOURS = TOKEN_TTL_HOURS;
