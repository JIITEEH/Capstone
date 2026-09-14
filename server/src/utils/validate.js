import { HttpError } from './httpError.js';

export function requireText(value, label, { max = 200 } = {}) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new HttpError(400, `${label} is required`);
  }
  const text = value.trim();
  if (text.length > max) throw new HttpError(400, `${label} must be ${max} characters or fewer`);
  return text;
}

export function optionalText(value, label, { max = 200 } = {}) {
  if (value === undefined || value === null) return '';
  if (typeof value !== 'string') throw new HttpError(400, `${label} must be text`);
  const text = value.trim();
  if (text.length > max) throw new HttpError(400, `${label} must be ${max} characters or fewer`);
  return text;
}

export function requireEmail(value) {
  const email = requireText(value, 'Email', { max: 254 }).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new HttpError(400, 'Enter a valid email address');
  }
  return email;
}

export function requirePassword(value, label = 'Password') {
  if (typeof value !== 'string' || value.length < 8) {
    throw new HttpError(400, `${label} must be at least 8 characters`);
  }
  if (value.length > 200) throw new HttpError(400, `${label} is too long`);
  return value;
}

export function oneOf(value, allowed, label) {
  if (!allowed.includes(value)) throw new HttpError(400, `Invalid ${label}`);
  return value;
}

export function parseId(value, notFoundMessage = 'Not found') {
  const id = Number(value);
  if (!Number.isInteger(id) || id < 1) throw new HttpError(404, notFoundMessage);
  return id;
}

export function queryString(value) {
  return typeof value === 'string' ? value.trim() : '';
}
