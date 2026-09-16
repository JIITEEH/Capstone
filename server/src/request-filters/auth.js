import jwt from 'jsonwebtoken';
import config from '../config/index.js';
import * as User from '../database-queries/userModel.js';
import { HttpError } from '../helpers/httpError.js';

export function requireAuth(req, res, next) {
  const header = req.get('authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return next(new HttpError(401, 'Please sign in to continue'));

  let payload;
  try {
    payload = jwt.verify(token, config.jwtSecret);
  } catch {
    return next(new HttpError(401, 'Your session has expired. Please sign in again.'));
  }

  // Load the user on every request so role changes and deactivation take effect immediately
  const user = User.findById(Number(payload.sub));
  if (!user || !user.is_active) return next(new HttpError(401, 'This account is no longer available'));

  req.user = user;
  next();
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user?.role)) {
      return next(new HttpError(403, 'You do not have permission to do this'));
    }
    next();
  };
}
