import jwt from 'jsonwebtoken';
import config from '../config/index.js';
import { DEMO_PASSWORD, ROLES } from '../constants.js';
import * as PasswordReset from '../database-queries/passwordResetModel.js';
import * as User from '../database-queries/userModel.js';
import { verifyPassword } from '../helpers/password.js';
import { HttpError } from '../helpers/httpError.js';
import { optionalText, requireEmail, requirePassword, requireText } from '../helpers/validate.js';

// tv is the user's token_version when the token was issued; a later password change makes it stale
function issueToken(user, { remember = false } = {}) {
  const expiresIn = remember ? config.jwtRememberExpiresIn : config.jwtExpiresIn;
  return jwt.sign({ sub: String(user.id), role: user.role, tv: User.getTokenVersion(user.id) }, config.jwtSecret, {
    expiresIn,
  });
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
  res.status(201).json({ token: issueToken(user, { remember: true }), user });
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
  res.json({ token: issueToken(user, { remember: body.remember === true }), user });
}

// Always gives the same answer, so the form can't be used to find out which emails have accounts
export function forgotPassword(req, res) {
  const email = requireEmail(req.body?.email);
  const record = User.findByEmailWithHash(email);
  const response = { message: 'If an account exists for that email, we sent a link to reset its password.' };

  if (record?.is_active) {
    const token = PasswordReset.create(record.id);
    const resetUrl = `${config.clientOrigin}/reset-password?token=${token}`;
    // No email service is set up yet. Send resetUrl by email here once there is one.
    // Outside production the link is logged and returned so the flow can be tested.
    if (config.env !== 'production') {
      console.log(`Password reset link for ${email}: ${resetUrl}`);
      response.devResetUrl = resetUrl;
    }
  }

  res.json(response);
}

export function resetPassword(req, res) {
  const body = req.body ?? {};
  const password = requirePassword(body.password);
  if (typeof body.token !== 'string' || !body.token || !PasswordReset.consume(body.token, password)) {
    throw new HttpError(400, 'This reset link is invalid or has expired.');
  }
  res.json({ message: 'Your password has been reset. Sign in with your new password.' });
}

export function me(req, res) {
  res.json({ user: req.user });
}

export function updateMe(req, res) {
  const body = req.body ?? {};
  const fields = {};
  if (body.name !== undefined) fields.name = requireText(body.name, 'Name', { max: 120 });
  if (body.program !== undefined) fields.program = optionalText(body.program, 'Program', { max: 120 });

  let token;
  if (body.newPassword !== undefined) {
    const record = User.findByEmailWithHash(req.user.email);
    if (typeof body.currentPassword !== 'string' || !verifyPassword(body.currentPassword, record.password_hash)) {
      throw new HttpError(400, 'Current password is incorrect');
    }
    User.setPassword(req.user.id, requirePassword(body.newPassword, 'New password'));

    // The change signs out every other device, including this one's old token. Hand back a new
    // token for this device, keeping the "keep me signed in" choice it was issued with.
    const remember = req.auth ? req.auth.exp - req.auth.iat > 24 * 60 * 60 : false;
    token = issueToken(req.user, { remember });
  }

  const user = User.update(req.user.id, fields);
  res.json(token ? { user, token } : { user });
}

const MAX_DEMO_ACCOUNTS = 30;
const ROLE_ORDER = [...ROLES].reverse(); // admin, adviser, student

// Development only: lists the current active accounts so the login page can offer quick sign-in.
// Never available in production, where it would expose every user's email.
export function listDemoAccounts(req, res) {
  if (config.env === 'production') throw new HttpError(404, 'Not found');

  const accounts = User.list()
    .filter((user) => user.is_active)
    .sort((a, b) => ROLE_ORDER.indexOf(a.role) - ROLE_ORDER.indexOf(b.role) || a.name.localeCompare(b.name))
    .slice(0, MAX_DEMO_ACCOUNTS)
    .map((user) => ({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      // Accounts whose password was changed (or created by an admin) need it typed in
      usesDemoPassword: verifyPassword(DEMO_PASSWORD, User.findByEmailWithHash(user.email).password_hash),
    }));

  res.json({ demoPassword: DEMO_PASSWORD, accounts });
}
