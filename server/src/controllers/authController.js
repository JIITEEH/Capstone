import jwt from 'jsonwebtoken';
import config from '../config/index.js';
import * as User from '../models/userModel.js';
import { verifyPassword } from '../utils/password.js';
import { HttpError } from '../utils/httpError.js';
import { optionalText, requireEmail, requirePassword, requireText } from '../utils/validate.js';

function issueToken(user) {
  return jwt.sign({ sub: String(user.id), role: user.role }, config.jwtSecret, { expiresIn: config.jwtExpiresIn });
}

// Public sign-up creates student accounts only; admins create adviser and admin accounts
export function register(req, res) {
  const body = req.body ?? {};
  const name = requireText(body.name, 'Name', { max: 120 });
  const email = requireEmail(body.email);
  const program = optionalText(body.program, 'Program', { max: 120 });
  const password = requirePassword(body.password);

  if (User.emailTaken(email)) throw new HttpError(409, 'An account with this email already exists');

  const user = User.create({ name, email, password, role: 'student', program });
  res.status(201).json({ token: issueToken(user), user });
}

export function login(req, res) {
  const body = req.body ?? {};
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const record = email ? User.findByEmailWithHash(email) : null;

  if (!record || typeof body.password !== 'string' || !verifyPassword(body.password, record.password_hash)) {
    throw new HttpError(401, 'Incorrect email or password');
  }
  if (!record.is_active) {
    throw new HttpError(403, 'This account has been deactivated. Contact an administrator.');
  }

  const user = User.findById(record.id);
  res.json({ token: issueToken(user), user });
}

export function me(req, res) {
  res.json({ user: req.user });
}

export function updateMe(req, res) {
  const body = req.body ?? {};
  const fields = {};
  if (body.name !== undefined) fields.name = requireText(body.name, 'Name', { max: 120 });
  if (body.program !== undefined) fields.program = optionalText(body.program, 'Program', { max: 120 });

  if (body.newPassword !== undefined) {
    const record = User.findByEmailWithHash(req.user.email);
    if (typeof body.currentPassword !== 'string' || !verifyPassword(body.currentPassword, record.password_hash)) {
      throw new HttpError(400, 'Current password is incorrect');
    }
    User.setPassword(req.user.id, requirePassword(body.newPassword, 'New password'));
  }

  res.json({ user: User.update(req.user.id, fields) });
}
