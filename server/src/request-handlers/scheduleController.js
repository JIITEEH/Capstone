import { MAX_PANELISTS, MEETING_MODES, SCHEDULE_STATUSES, SCHEDULE_TYPES } from '../constants.js';
import { transaction } from '../database/index.js';
import * as Activity from '../database-queries/activityModel.js';
import * as Schedule from '../database-queries/scheduleModel.js';
import * as Thesis from '../database-queries/thesisModel.js';
import * as User from '../database-queries/userModel.js';
import {
  canManageSchedule,
  canViewSchedule,
  getAccessibleThesis,
  withSchedulePermissions,
} from '../permission-rules/access.js';
import { HttpError } from '../helpers/httpError.js';
import {
  oneOf,
  optionalText,
  parseId,
  requireDateTime,
  requireInt,
  requireText,
  toSqlDateTime,
} from '../helpers/validate.js';

function loadSchedule(user, rawId) {
  const schedule = Schedule.findById(parseId(rawId, 'Event not found'));
  if (!canViewSchedule(user, schedule)) throw new HttpError(404, 'Event not found');
  return schedule;
}

function readEventFields(body, { partial }) {
  const fields = {};
  const has = (key) => !partial || body[key] !== undefined;
  if (has('title')) fields.title = requireText(body.title, 'Title', { max: 150 });
  if (has('startsAt')) fields.starts_at = requireDateTime(body.startsAt, 'Start time');
  if (has('durationMinutes')) fields.duration_minutes = requireInt(body.durationMinutes, 'Duration', { min: 15, max: 480 });
  if (has('mode')) fields.mode = oneOf(body.mode, MEETING_MODES, 'meeting mode');
  if (has('location')) fields.location = optionalText(body.location, 'Location', { max: 300 });
  if (has('notes')) fields.notes = optionalText(body.notes, 'Notes', { max: 2000 });
  return fields;
}

// Returns undefined when the request doesn't mention panelists
function readPanelists(user, body, type, thesis) {
  if (body.panelistIds === undefined) return undefined;
  if (!Array.isArray(body.panelistIds)) throw new HttpError(400, 'Panelists must be a list');

  const ids = [...new Set(body.panelistIds.map(Number))];
  if (!ids.length) return ids;
  if (user.role !== 'admin') throw new HttpError(403, 'Only admins can assign panelists');
  if (type === 'consultation') throw new HttpError(400, "Consultations don't have panelists");
  if (ids.length > MAX_PANELISTS) throw new HttpError(400, `A panel can have at most ${MAX_PANELISTS} members`);

  for (const id of ids) {
    const adviser = User.findById(id);
    if (!adviser || adviser.role !== 'adviser' || !adviser.is_active) {
      throw new HttpError(400, 'Panelists must be active advisers');
    }
    if (id === thesis.adviser_id) throw new HttpError(400, "The student's adviser can't also be a panelist");
  }
  return ids;
}

function assertNoConflict({ thesis, panelistIds, startsAt, durationMinutes, excludeId }) {
  const adviserIds = [thesis.adviser_id, ...panelistIds].filter(Boolean);
  const conflict = Schedule.findConflict({ thesisId: thesis.id, adviserIds, startsAt, durationMinutes, excludeId });
  if (conflict) {
    throw new HttpError(
      409,
      `This time overlaps with "${conflict.title}" for ${conflict.student_name}. Choose another time.`,
    );
  }
}

export function listSchedules(req, res) {
  const { user } = req;
  const range = ['upcoming', 'past'].includes(req.query.range) ? req.query.range : 'all';
  const filters = { range };

  if (user.role === 'student') filters.studentId = user.id;
  if (user.role === 'adviser') filters.adviserId = user.id;
  if (req.query.thesisId) filters.thesisId = getAccessibleThesis(user, req.query.thesisId).id;

  res.json(Schedule.list(filters).map((schedule) => withSchedulePermissions(user, schedule)));
}

export function createSchedule(req, res) {
  const { user } = req;
  const body = req.body ?? {};
  const thesis = getAccessibleThesis(user, body.thesisId);
  const type = oneOf(body.type, Object.keys(SCHEDULE_TYPES), 'event type');

  if (user.role === 'adviser' && type !== 'consultation') {
    throw new HttpError(403, 'Advisers can schedule consultations only. Defenses are scheduled by an admin.');
  }
  if (!thesis.adviser_id) throw new HttpError(400, 'Assign an adviser to this thesis before scheduling');

  const fields = readEventFields(body, { partial: false });
  if (fields.starts_at <= toSqlDateTime(new Date())) throw new HttpError(400, 'Choose a time in the future');

  const panelistIds = readPanelists(user, body, type, thesis) ?? [];
  assertNoConflict({ thesis, panelistIds, startsAt: fields.starts_at, durationMinutes: fields.duration_minutes });

  const schedule = transaction(() => {
    const id = Schedule.create({ ...fields, thesis_id: thesis.id, type, created_by: user.id });
    Schedule.setPanelists(id, panelistIds);
    Activity.log(thesis.id, user.id, `scheduled a ${SCHEDULE_TYPES[type].toLowerCase()}`);
    return Schedule.findById(id);
  });
  res.status(201).json(withSchedulePermissions(user, schedule));
}

export function updateSchedule(req, res) {
  const { user } = req;
  const schedule = loadSchedule(user, req.params.id);
  if (!canManageSchedule(user, schedule)) throw new HttpError(403, 'You can view this event but not change it');

  const body = req.body ?? {};
  const thesis = Thesis.findById(schedule.thesis_id);
  const fields = readEventFields(body, { partial: true });
  if (body.status !== undefined) fields.status = oneOf(body.status, SCHEDULE_STATUSES, 'status');
  const panelistIds = readPanelists(user, body, schedule.type, thesis);

  const rescheduled = fields.starts_at !== undefined && fields.starts_at !== schedule.starts_at;
  if (rescheduled && fields.starts_at <= toSqlDateTime(new Date())) {
    throw new HttpError(400, 'Choose a time in the future');
  }

  const nextStatus = fields.status ?? schedule.status;
  const timingChanged =
    rescheduled || fields.duration_minutes !== undefined || panelistIds !== undefined || schedule.status !== 'scheduled';
  if (nextStatus === 'scheduled' && timingChanged) {
    assertNoConflict({
      thesis,
      panelistIds: panelistIds ?? schedule.panelists.map((panelist) => panelist.id),
      startsAt: fields.starts_at ?? schedule.starts_at,
      durationMinutes: fields.duration_minutes ?? schedule.duration_minutes,
      excludeId: schedule.id,
    });
  }

  const label = SCHEDULE_TYPES[schedule.type].toLowerCase();
  let action = `updated the ${label}`;
  if (fields.status && fields.status !== schedule.status) {
    action = {
      cancelled: `cancelled the ${label}`,
      completed: `marked the ${label} as completed`,
      scheduled: `restored the ${label}`,
    }[fields.status];
  } else if (rescheduled) {
    action = `rescheduled the ${label}`;
  }

  const updated = transaction(() => {
    Schedule.update(schedule.id, fields);
    if (panelistIds) Schedule.setPanelists(schedule.id, panelistIds);
    Activity.log(thesis.id, user.id, action);
    return Schedule.findById(schedule.id);
  });
  res.json(withSchedulePermissions(user, updated));
}

export function deleteSchedule(req, res) {
  const schedule = loadSchedule(req.user, req.params.id);
  transaction(() => {
    Schedule.remove(schedule.id);
    Activity.log(schedule.thesis_id, req.user.id, `deleted the ${SCHEDULE_TYPES[schedule.type].toLowerCase()}`);
  });
  res.status(204).end();
}
