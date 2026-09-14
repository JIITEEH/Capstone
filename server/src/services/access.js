import * as Thesis from '../models/thesisModel.js';
import { HttpError } from '../utils/httpError.js';
import { parseId } from '../utils/validate.js';

// Students see only their own thesis, advisers only theses assigned to them, admins everything
export function canViewThesis(user, thesis) {
  if (!thesis) return false;
  if (user.role === 'admin') return true;
  if (user.role === 'student') return thesis.student_id === user.id;
  if (user.role === 'adviser') return thesis.adviser_id === user.id;
  return false;
}

// Responds 404 rather than 403 so users can't probe which thesis ids exist
export function getAccessibleThesis(user, rawId) {
  const thesis = Thesis.findById(parseId(rawId, 'Thesis not found'));
  if (!canViewThesis(user, thesis)) throw new HttpError(404, 'Thesis not found');
  return thesis;
}
