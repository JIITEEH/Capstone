import * as Thesis from '../models/thesisModel.js';
import { HttpError } from '../utils/httpError.js';
import { parseId } from '../utils/validate.js';

// Students see only their own group's thesis, advisers only theses assigned to them, admins everything
export function canViewThesis(user, thesis) {
  if (!thesis) return false;
  if (user.role === 'admin') return true;
  if (user.role === 'student') return Thesis.isMember(thesis.id, user.id);
  if (user.role === 'adviser') return thesis.adviser_id === user.id;
  return false;
}

// The group leader and admins add and remove members
export function canManageGroup(user, thesis) {
  if (user.role === 'admin') return true;
  return user.role === 'student' && Thesis.isLeader(thesis.id, user.id);
}

// Responds 404 rather than 403 so users can't probe which thesis ids exist
export function getAccessibleThesis(user, rawId) {
  const thesis = Thesis.findById(parseId(rawId, 'Thesis not found'));
  if (!canViewThesis(user, thesis)) throw new HttpError(404, 'Thesis not found');
  return thesis;
}

// Panelists can see a defense without getting access to the thesis itself
export function canViewSchedule(user, schedule) {
  if (!schedule) return false;
  if (user.role === 'admin') return true;
  if (user.role === 'student') return Thesis.isMember(schedule.thesis_id, user.id);
  if (user.role === 'adviser') {
    return schedule.adviser_id === user.id || schedule.panelists.some((panelist) => panelist.id === user.id);
  }
  return false;
}

// Admins manage every event; advisers manage consultations with their own advisees
export function canManageSchedule(user, schedule) {
  if (user.role === 'admin') return true;
  return user.role === 'adviser' && schedule.type === 'consultation' && schedule.adviser_id === user.id;
}

// Adds flags the UI uses to decide which actions to show
export function withSchedulePermissions(user, schedule) {
  return {
    ...schedule,
    can_manage: canManageSchedule(user, schedule),
    can_delete: user.role === 'admin',
  };
}
