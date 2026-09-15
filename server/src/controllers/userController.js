import { ROLES } from '../constants.js';
import { transaction } from '../db/index.js';
import * as Submission from '../models/submissionModel.js';
import * as Thesis from '../models/thesisModel.js';
import * as User from '../models/userModel.js';
import { deleteStoredFiles } from '../utils/files.js';
import { HttpError } from '../utils/httpError.js';
import {
  oneOf,
  optionalText,
  parseId,
  queryString,
  requireEmail,
  requirePassword,
  requireText,
} from '../utils/validate.js';

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

  res.status(201).json(User.create({ name, email, password, role, program }));
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
      throw new HttpError(400, 'This student has a thesis. Delete the thesis before changing their role.');
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

  if (body.password) User.setPassword(id, requirePassword(body.password));

  res.json(User.update(id, fields));
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
  });
  deleteStoredFiles(files);
  res.status(204).end();
}
