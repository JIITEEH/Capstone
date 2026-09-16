import { MAX_GROUP_SIZE, STAGES, THESIS_STATUSES } from '../constants.js';
import { transaction } from '../database/index.js';
import * as Activity from '../database-queries/activityModel.js';
import * as Audit from '../database-queries/auditModel.js';
import * as Schedule from '../database-queries/scheduleModel.js';
import * as Submission from '../database-queries/submissionModel.js';
import * as Thesis from '../database-queries/thesisModel.js';
import * as User from '../database-queries/userModel.js';
import { canManageGroup, getAccessibleThesis, withSchedulePermissions } from '../permission-rules/access.js';
import { deleteStoredFiles } from '../helpers/files.js';
import { HttpError } from '../helpers/httpError.js';
import { oneOf, optionalText, parseId, queryString, requireEmail, requireText } from '../helpers/validate.js';

function readThesisFields(body, { partial }) {
  const fields = {};
  if (!partial || body.title !== undefined) fields.title = requireText(body.title, 'Title', { max: 250 });
  if (!partial || body.abstract !== undefined) fields.abstract = optionalText(body.abstract, 'Abstract', { max: 5000 });
  if (!partial || body.keywords !== undefined) fields.keywords = optionalText(body.keywords, 'Keywords', { max: 300 });
  return fields;
}

export function listTheses(req, res) {
  const { user } = req;
  const status = THESIS_STATUSES[req.query.status] ? req.query.status : undefined;
  const filters = { status, search: queryString(req.query.search) };

  if (user.role === 'student') filters.studentId = user.id;
  if (user.role === 'adviser') filters.adviserId = user.id;
  if (user.role === 'admin') {
    if (req.query.adviser === 'unassigned') filters.unassigned = true;
    else if (Number(req.query.adviser) > 0) filters.adviserId = Number(req.query.adviser);
  }

  res.json(Thesis.list(filters));
}

export function createThesis(req, res) {
  if (Thesis.findByStudent(req.user.id)) throw new HttpError(409, 'You already have a thesis');

  const fields = readThesisFields(req.body ?? {}, { partial: false });
  const thesis = transaction(() => {
    const created = Thesis.create({ studentId: req.user.id, ...fields });
    Activity.log(created.id, req.user.id, 'created the thesis');
    return created;
  });
  res.status(201).json(thesis);
}

export function getThesis(req, res) {
  const thesis = getAccessibleThesis(req.user, req.params.id);
  res.json({
    thesis,
    members: Thesis.listMembers(thesis.id),
    groupLimit: MAX_GROUP_SIZE,
    submissions: Submission.listByThesis(thesis.id),
    schedules: Schedule.list({ thesisId: thesis.id, range: 'upcoming' }).map((event) =>
      withSchedulePermissions(req.user, event),
    ),
    activity: Activity.listRecent({ thesisId: thesis.id, limit: 15 }),
  });
}

export function updateThesis(req, res) {
  const thesis = getAccessibleThesis(req.user, req.params.id);
  if (thesis.status === 'completed') {
    throw new HttpError(400, 'Completed theses can no longer be edited');
  }

  const fields = readThesisFields(req.body ?? {}, { partial: true });
  const updated = transaction(() => {
    const result = Thesis.update(thesis.id, fields);
    Activity.log(thesis.id, req.user.id, 'updated the thesis details');
    return result;
  });
  res.json(updated);
}

export function assignAdviser(req, res) {
  const thesis = getAccessibleThesis(req.user, req.params.id);
  const rawId = req.body?.adviserId;

  let adviser = null;
  if (rawId !== null && rawId !== undefined && rawId !== '') {
    adviser = User.findById(Number(rawId));
    if (!adviser || adviser.role !== 'adviser' || !adviser.is_active) {
      throw new HttpError(400, 'Choose an active adviser');
    }
  }
  if ((adviser?.id ?? null) === thesis.adviser_id) return res.json(thesis);

  const updated = transaction(() => {
    const result = Thesis.update(thesis.id, { adviser_id: adviser?.id ?? null });
    Activity.log(thesis.id, req.user.id, adviser ? `assigned ${adviser.name} as adviser` : 'removed the adviser');
    Audit.record({
      actor: req.user,
      action: adviser ? 'thesis.adviser_assigned' : 'thesis.adviser_removed',
      targetType: 'thesis',
      targetId: thesis.id,
      targetLabel: thesis.title,
      details: `${thesis.adviser_name ?? 'No adviser'} → ${adviser?.name ?? 'No adviser'}`,
    });
    return result;
  });
  res.json(updated);
}

export function updateStatus(req, res) {
  const thesis = getAccessibleThesis(req.user, req.params.id);
  const status = oneOf(req.body?.status, Object.keys(THESIS_STATUSES), 'status');

  const updated = transaction(() => {
    const result = Thesis.update(thesis.id, { status });
    Activity.log(thesis.id, req.user.id, `changed the status to ${THESIS_STATUSES[status]}`);
    // An override replaces the status the reviews produced, so it is worth a permanent record
    if (status !== thesis.status) {
      Audit.record({
        actor: req.user,
        action: 'thesis.status_overridden',
        targetType: 'thesis',
        targetId: thesis.id,
        targetLabel: thesis.title,
        details: `${THESIS_STATUSES[thesis.status]} → ${THESIS_STATUSES[status]}`,
      });
    }
    return result;
  });
  res.json(updated);
}

export function deleteThesis(req, res) {
  const thesis = getAccessibleThesis(req.user, req.params.id);
  const files = Submission.storedNamesForThesis(thesis.id);
  transaction(() => {
    Thesis.remove(thesis.id);
    Audit.record({
      actor: req.user,
      action: 'thesis.deleted',
      targetType: 'thesis',
      targetId: thesis.id,
      targetLabel: thesis.title,
      details: `${files.length} uploaded file${files.length === 1 ? '' : 's'} removed`,
    });
  });
  deleteStoredFiles(files);
  res.status(204).end();
}

// Completed theses are frozen for students; admins can still fix the group
function assertGroupEditable(user, thesis) {
  if (thesis.status === 'completed' && user.role !== 'admin') {
    throw new HttpError(400, 'Completed theses can no longer change members');
  }
}

// The group leader or an admin adds a classmate by the email on their student account
export function addMember(req, res) {
  const thesis = getAccessibleThesis(req.user, req.params.id);
  if (!canManageGroup(req.user, thesis)) throw new HttpError(403, 'Only the group leader can add members');
  assertGroupEditable(req.user, thesis);

  const email = requireEmail(req.body?.email);
  const student = User.findByEmailWithHash(email);
  if (!student || student.role !== 'student' || !student.is_active) {
    throw new HttpError(400, 'No active student account uses that email');
  }

  const current = Thesis.findByStudent(student.id);
  if (current) {
    throw new HttpError(
      409,
      current.id === thesis.id
        ? `${student.name} is already in this group`
        : `${student.name} is already in another thesis group`,
    );
  }
  if (thesis.member_count >= MAX_GROUP_SIZE) {
    throw new HttpError(400, `A group can have at most ${MAX_GROUP_SIZE} students`);
  }

  transaction(() => {
    Thesis.addMember(thesis.id, student.id);
    Activity.log(thesis.id, req.user.id, `added ${student.name} to the group`);
  });
  res.status(201).json(Thesis.listMembers(thesis.id));
}

// The leader or an admin removes a member, and any member can remove themselves to leave.
// A thesis always keeps at least one student; if the leader goes, the next member takes over.
export function removeMember(req, res) {
  const thesis = getAccessibleThesis(req.user, req.params.id);
  const studentId = parseId(req.params.studentId, 'Member not found');
  const members = Thesis.listMembers(thesis.id);
  const member = members.find((m) => m.id === studentId);
  if (!member) throw new HttpError(404, 'Member not found');

  const leaving = studentId === req.user.id;
  if (!leaving && !canManageGroup(req.user, thesis)) {
    throw new HttpError(403, 'Only the group leader can remove members');
  }
  assertGroupEditable(req.user, thesis);
  if (members.length === 1) {
    throw new HttpError(
      400,
      leaving
        ? "You're the only member, so you can't leave. An admin can delete the thesis instead."
        : 'A thesis needs at least one student',
    );
  }

  transaction(() => {
    Thesis.removeMember(thesis.id, studentId);
    Activity.log(thesis.id, req.user.id, leaving ? 'left the group' : `removed ${member.name} from the group`);
  });
  res.status(204).end();
}

export function createSubmission(req, res) {
  try {
    const thesis = getAccessibleThesis(req.user, req.params.id);
    const body = req.body ?? {};
    const stage = oneOf(body.stage, Object.keys(STAGES), 'stage');
    const notes = optionalText(body.notes, 'Notes', { max: 2000 });

    if (thesis.status === 'completed') throw new HttpError(400, 'This thesis is already completed');
    if (Submission.hasPending(thesis.id)) {
      throw new HttpError(400, 'You already have a submission waiting for review');
    }
    if (Submission.isStageApproved(thesis.id, stage)) {
      throw new HttpError(400, `${STAGES[stage]} has already been approved`);
    }
    // Stages unlock in order: every earlier stage must be approved first
    const order = Object.keys(STAGES);
    const blocking = order.slice(0, order.indexOf(stage)).find((key) => !Submission.isStageApproved(thesis.id, key));
    if (blocking) {
      throw new HttpError(400, `${STAGES[blocking]} must be approved before you can submit ${STAGES[stage]}`);
    }
    if (!req.file) throw new HttpError(400, 'Attach your manuscript file');

    const submission = transaction(() => {
      const created = Submission.create({ thesisId: thesis.id, stage, notes, file: req.file });
      Thesis.recomputeStatus(thesis.id);
      Activity.log(thesis.id, req.user.id, `submitted ${STAGES[stage]}`);
      return created;
    });
    res.status(201).json(submission);
  } catch (err) {
    // Don't keep files from rejected submissions
    if (req.file) deleteStoredFiles([req.file.filename]);
    throw err;
  }
}
