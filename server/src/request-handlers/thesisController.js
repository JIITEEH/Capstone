import { MAX_GROUP_SIZE, STAGES, THESIS_STATUSES } from '../constants.js';
import { transaction } from '../database/index.js';
import * as Activity from '../database-queries/activityModel.js';
import * as Audit from '../database-queries/auditModel.js';
import * as Invitation from '../database-queries/invitationModel.js';
import * as Notification from '../database-queries/notificationModel.js';
import * as Schedule from '../database-queries/scheduleModel.js';
import * as Submission from '../database-queries/submissionModel.js';
import * as Term from '../database-queries/termModel.js';
import * as Thesis from '../database-queries/thesisModel.js';
import * as User from '../database-queries/userModel.js';
import { canManageGroup, getAccessibleThesis, withSchedulePermissions } from '../permission-rules/access.js';
import { sendCsv, toCsv } from '../helpers/csv.js';
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

// Shared by the list and its CSV export, so a download always matches what is on screen
function thesisFilters(req) {
  const { user } = req;
  const status = THESIS_STATUSES[req.query.status] ? req.query.status : undefined;
  const filters = { status, search: queryString(req.query.search), overdue: req.query.deadline === 'overdue' };
  if (req.query.term === 'none') filters.termId = 'none';
  else if (Number(req.query.term) > 0) filters.termId = Number(req.query.term);

  if (user.role === 'student') filters.studentId = user.id;
  if (user.role === 'adviser') filters.adviserId = user.id;
  if (user.role === 'admin') {
    if (req.query.adviser === 'unassigned') filters.unassigned = true;
    else if (Number(req.query.adviser) > 0) filters.adviserId = Number(req.query.adviser);
  }
  return filters;
}

export function listTheses(req, res) {
  res.json(Thesis.list(thesisFilters(req)));
}

// The first stage not yet approved is the one the group is working on
function currentStage(thesis) {
  const approved = new Set((thesis.approved_stage_keys ?? '').split(',').filter(Boolean));
  const next = Object.keys(STAGES).find((key) => !approved.has(key));
  return next ? STAGES[next] : 'All stages approved';
}

export function exportTheses(req, res) {
  const csv = toCsv(
    [
      { header: 'Title', value: (t) => t.title },
      { header: 'Students', value: (t) => t.student_name },
      { header: 'Program', value: (t) => t.student_program },
      { header: 'Adviser', value: (t) => t.adviser_name ?? 'Not assigned' },
      { header: 'Current stage', value: currentStage },
      { header: 'Stages approved', value: (t) => `${t.approved_stages} of ${Object.keys(STAGES).length}` },
      { header: 'Status', value: (t) => THESIS_STATUSES[t.status] ?? t.status },
      { header: 'Term', value: (t) => t.term_name ?? '' },
      { header: 'Next due', value: (t) => (t.next_due_stage ? `${STAGES[t.next_due_stage]}, ${t.next_due_on}` : '') },
      { header: 'Overdue', value: (t) => (t.next_due_days_left < 0 ? 'Yes' : '') },
      { header: 'Keywords', value: (t) => t.keywords },
      { header: 'Started', value: (t) => t.created_at },
      { header: 'Last updated', value: (t) => t.updated_at },
    ],
    Thesis.list(thesisFilters(req)),
  );
  sendCsv(res, 'theses', csv);
}

export function createThesis(req, res) {
  if (!req.user.email_verified) {
    throw new HttpError(403, 'Verify your email address before starting a thesis. Check your inbox for the link.');
  }
  if (Thesis.findByStudent(req.user.id)) throw new HttpError(409, 'You already have a thesis');

  const fields = readThesisFields(req.body ?? {}, { partial: false });
  const thesis = transaction(() => {
    const created = Thesis.create({ studentId: req.user.id, termId: Term.findCurrent()?.id ?? null, ...fields });
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
    invitations: Invitation.listPendingForThesis(thesis.id),
    deadlines: Term.deadlinesForThesis(thesis.id),
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
    if (adviser) {
      Notification.notify({
        recipients: [adviser.id],
        actorId: req.user.id,
        type: 'adviser.assigned',
        title: 'You have a new advisee',
        body: thesis.title,
        link: `/theses/${thesis.id}`,
      });
    }
    Notification.notify({
      recipients: Thesis.listMembers(thesis.id).map((member) => member.id),
      actorId: req.user.id,
      type: adviser ? 'adviser.assigned' : 'adviser.removed',
      title: adviser ? `${adviser.name} is now your adviser` : 'Your adviser was removed',
      body: thesis.title,
      link: '/thesis',
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

// Admins move a thesis to another term, or out of every term, which changes its deadlines
export function setTerm(req, res) {
  const thesis = getAccessibleThesis(req.user, req.params.id);
  const rawId = req.body?.termId;

  let term = null;
  if (rawId !== null && rawId !== undefined && rawId !== '') {
    term = Term.findById(Number(rawId));
    if (!term) throw new HttpError(400, 'Choose a term that exists');
  }
  if ((term?.id ?? null) === thesis.term_id) return res.json(thesis);

  const updated = transaction(() => {
    const result = Thesis.update(thesis.id, { term_id: term?.id ?? null });
    Activity.log(thesis.id, req.user.id, term ? `moved the thesis to ${term.name}` : 'removed the thesis from its term');
    Audit.record({
      actor: req.user,
      action: 'thesis.term_changed',
      targetType: 'thesis',
      targetId: thesis.id,
      targetLabel: thesis.title,
      details: `${thesis.term_name ?? 'No term'} → ${term?.name ?? 'No term'}`,
    });
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

// Admins add a student directly, to fix a group. Leaders invite instead; see inviteMember.
export function addMember(req, res) {
  const thesis = getAccessibleThesis(req.user, req.params.id);
  if (req.user.role !== 'admin') {
    throw new HttpError(403, 'Group leaders invite classmates instead of adding them. Use Invite a classmate.');
  }
  assertGroupEditable(req.user, thesis);

  const email = requireEmail(req.body?.email);
  const student = User.findByEmailWithHash(email);
  if (!student || student.role !== 'student' || !student.is_active) {
    throw new HttpError(400, 'No active student account uses that email');
  }
  // Stops someone registering with a classmate's address and being added in their place
  if (!student.email_verified_at) {
    throw new HttpError(400, `${student.name} needs to verify their email address before joining a group`);
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
    Notification.notify({
      recipients: [student.id],
      actorId: req.user.id,
      type: 'group.added',
      title: 'An admin added you to a thesis group',
      body: thesis.title,
      link: '/thesis',
    });
  });
  res.status(201).json(Thesis.listMembers(thesis.id));
}

// Finds the student behind an invitation email, with the checks that apply to anyone joining a group
function findJoinableStudent(email) {
  const student = User.findByEmailWithHash(email);
  if (!student || student.role !== 'student' || !student.is_active) {
    throw new HttpError(400, 'No active student account uses that email');
  }
  if (!student.email_verified_at) {
    throw new HttpError(400, `${student.name} needs to verify their email address before joining a group`);
  }
  return student;
}

// The group leader invites a classmate, who then accepts or declines. Whether the classmate is
// already in another group is deliberately not checked here: telling the leader would reveal who
// is taken. The invitee finds out, privately, when they try to accept.
export function inviteMember(req, res) {
  const thesis = getAccessibleThesis(req.user, req.params.id);
  if (!canManageGroup(req.user, thesis)) throw new HttpError(403, 'Only the group leader can invite classmates');
  assertGroupEditable(req.user, thesis);

  const student = findJoinableStudent(requireEmail(req.body?.email));
  if (Thesis.isMember(thesis.id, student.id)) throw new HttpError(409, `${student.name} is already in this group`);
  if (Invitation.findPending(thesis.id, student.id)) {
    throw new HttpError(409, `${student.name} already has an invitation to this group`);
  }
  // Pending invitations count toward the limit, so a leader can't invite past a full group
  if (thesis.member_count + Invitation.countPendingForThesis(thesis.id) >= MAX_GROUP_SIZE) {
    throw new HttpError(400, `A group can have at most ${MAX_GROUP_SIZE} students, counting pending invitations`);
  }

  const invitation = transaction(() => {
    const created = Invitation.create({ thesisId: thesis.id, studentId: student.id, invitedBy: req.user.id });
    Activity.log(thesis.id, req.user.id, `invited ${student.name} to the group`);
    Notification.notify({
      recipients: [student.id],
      actorId: req.user.id,
      type: 'group.invited',
      title: `${req.user.name} invited you to join their thesis group`,
      body: thesis.title,
      link: '/thesis',
    });
    return created;
  });
  res.status(201).json(invitation);
}

export function cancelInvitation(req, res) {
  const thesis = getAccessibleThesis(req.user, req.params.id);
  if (!canManageGroup(req.user, thesis)) throw new HttpError(403, 'Only the group leader can cancel invitations');

  const invitation = Invitation.findById(parseId(req.params.invitationId, 'Invitation not found'));
  if (!invitation || invitation.thesis_id !== thesis.id || invitation.status !== 'pending') {
    throw new HttpError(404, 'Invitation not found');
  }

  transaction(() => {
    Invitation.setStatus(invitation.id, 'cancelled');
    Activity.log(thesis.id, req.user.id, `cancelled the invitation to ${invitation.student_name}`);
  });
  res.status(204).end();
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
      // The adviser has something to review; groupmates see it arrive too
      Notification.notify({
        recipients: Notification.thesisParticipants(thesis.id),
        actorId: req.user.id,
        type: 'submission.created',
        title: `${STAGES[stage]} submitted for review`,
        body: `${req.user.name} · ${thesis.title}`,
        link: `/submissions/${created.id}`,
      });
      return created;
    });
    res.status(201).json(submission);
  } catch (err) {
    // Don't keep files from rejected submissions
    if (req.file) deleteStoredFiles([req.file.filename]);
    throw err;
  }
}
