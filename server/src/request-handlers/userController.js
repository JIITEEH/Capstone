import { ROLES } from '../constants.js';
import { transaction } from '../database/index.js';
import * as Audit from '../database-queries/auditModel.js';
import * as Submission from '../database-queries/submissionModel.js';
import * as Thesis from '../database-queries/thesisModel.js';
import * as User from '../database-queries/userModel.js';
import { deleteStoredFiles } from '../helpers/files.js';
import { HttpError } from '../helpers/httpError.js';
import {
  oneOf,
  optionalText,
  parseId,
  queryString,
  requireEmail,
  requirePassword,
  requireText,
} from '../helpers/validate.js';

export function listUsers(req, res) {
  const role = ROLES.includes(req.query.role) ? req.query.role : undefined;
  res.json(User.list({ role, search: queryString(req.query.search) }));
}

export function listAdvisers(req, res) {
  res.json(User.listAdvisers());
}

export function createUser(req, res) {
  const body = req.body ?? {};
  const name = requireText(body.name, 'Name', { max: 120 });
  const email = requireEmail(body.email);
  const role = oneOf(body.role, ROLES, 'role');
  const program = optionalText(body.program, 'Program', { max: 120 });
  const password = requirePassword(body.password);

  if (User.emailTaken(email)) throw new HttpError(409, 'An account with this email already exists');

  const created = transaction(() => {
    const user = User.create({ name, email, password, role, program });
    Audit.record({
      actor: req.user,
      action: 'user.created',
      targetType: 'user',
      targetId: user.id,
      targetLabel: `${user.name} (${user.email})`,
      details: `Role: ${role}`,
    });
    return user;
  });
  res.status(201).json(created);
}

export function updateUser(req, res) {
  const id = parseId(req.params.id, 'User not found');
  const existing = User.findById(id);
  if (!existing) throw new HttpError(404, 'User not found');

  const body = req.body ?? {};
  const fields = {};

  if (body.name !== undefined) fields.name = requireText(body.name, 'Name', { max: 120 });
  if (body.program !== undefined) fields.program = optionalText(body.program, 'Program', { max: 120 });

  if (body.email !== undefined) {
    fields.email = requireEmail(body.email);
    if (User.emailTaken(fields.email, id)) throw new HttpError(409, 'An account with this email already exists');
  }

  if (body.role !== undefined && body.role !== existing.role) {
    oneOf(body.role, ROLES, 'role');
    if (id === req.user.id) throw new HttpError(400, "You can't change your own role");
    if (existing.role === 'student' && Thesis.findByStudent(id)) {
      throw new HttpError(
        400,
        'This student is in a thesis group. Remove them from the group, or delete the thesis, before changing their role.',
      );
    }
    if (existing.role === 'adviser' && Thesis.list({ adviserId: id }).length) {
      throw new HttpError(400, "Reassign this adviser's students before changing their role.");
    }
    fields.role = body.role;
  }

  if (body.is_active !== undefined) {
    const active = Boolean(body.is_active);
    if (!active && id === req.user.id) throw new HttpError(400, "You can't deactivate your own account");
    fields.is_active = active ? 1 : 0;
  }

  const newPassword = body.password ? requirePassword(body.password) : null;

  // What actually changed, compared with the stored account. A save that changes nothing logs nothing.
  const label = `${existing.name} (${existing.email})`;
  const entries = [];
  const detailChanges = ['name', 'email', 'program']
    .filter((key) => fields[key] !== undefined && fields[key] !== existing[key])
    .map((key) => `${key}: "${existing[key] || '—'}" → "${fields[key] || '—'}"`);
  if (detailChanges.length) entries.push({ action: 'user.details_changed', details: detailChanges.join('; ') });
  if (fields.role !== undefined) entries.push({ action: 'user.role_changed', details: `${existing.role} → ${fields.role}` });
  if (fields.is_active !== undefined && fields.is_active !== existing.is_active) {
    entries.push({ action: fields.is_active ? 'user.reactivated' : 'user.deactivated' });
  }
  // Only that it happened. The password itself is never written to the log.
  if (newPassword) entries.push({ action: 'user.password_set' });

  const updated = transaction(() => {
    if (newPassword) User.setPassword(id, newPassword);
    const result = User.update(id, fields);
    for (const entry of entries) {
      Audit.record({ actor: req.user, targetType: 'user', targetId: id, targetLabel: label, ...entry });
    }
    return result;
  });
  res.json(updated);
}

export function deleteUser(req, res) {
  const id = parseId(req.params.id, 'User not found');
  if (id === req.user.id) throw new HttpError(400, "You can't delete your own account");

  const existing = User.findById(id);
  if (!existing) throw new HttpError(404, 'User not found');

  // A student leaves their group when deleted. If they were its last member the thesis goes too,
  // along with its uploaded files; otherwise the group keeps the thesis and gets a new leader if needed.
  const thesis = existing.role === 'student' ? Thesis.findByStudent(id) : null;
  const deletesThesis = Boolean(thesis) && thesis.member_count === 1;
  const files = deletesThesis ? Submission.storedNamesForThesis(thesis.id) : [];

  transaction(() => {
    if (deletesThesis) Thesis.remove(thesis.id);
    else if (thesis) Thesis.removeMember(thesis.id, id);
    User.remove(id);
    Audit.record({
      actor: req.user,
      action: 'user.deleted',
      targetType: 'user',
      targetId: id,
      targetLabel: `${existing.name} (${existing.email})`,
      details: deletesThesis
        ? `Role: ${existing.role}. They were the last member of "${thesis.title}", so that thesis and its files were deleted too.`
        : `Role: ${existing.role}`,
    });
  });
  deleteStoredFiles(files);
  res.status(204).end();
}
