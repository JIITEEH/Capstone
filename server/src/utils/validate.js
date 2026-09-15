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

// Accepts an ISO 8601 string with a timezone and returns SQLite's UTC format
export function requireDateTime(value, label) {
  if (typeof value !== 'string' || !value) throw new HttpError(400, `${label} is required`);
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new HttpError(400, `${label} is not a valid date`);
  return toSqlDateTime(date);
}

export function toSqlDateTime(date) {
  return date.toISOString().slice(0, 19).replace('T', ' ');
}

export function requireInt(value, label, { min, max }) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < min || number > max) {
    throw new HttpError(400, `${label} must be between ${min} and ${max}`);
  }
  return number;
}

export function parseId(value, notFoundMessage = 'Not found') {
  const id = Number(value);
  if (!Number.isInteger(id) || id < 1) throw new HttpError(404, notFoundMessage);
  return id;
}

export function queryString(value) {
  return typeof value === 'string' ? value.trim() : '';
}
