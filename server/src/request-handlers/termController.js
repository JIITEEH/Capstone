import { STAGES } from '../constants.js';
import { transaction } from '../database/index.js';
import * as Term from '../database-queries/termModel.js';
import { HttpError } from '../helpers/httpError.js';
import { parseId, requireText } from '../helpers/validate.js';

// A calendar day as YYYY-MM-DD, checked to be a real date (so no 2026-02-30)
function readDay(value, label, { required }) {
  if (value === undefined || value === null || value === '') {
    if (required) throw new HttpError(400, `${label} is required`);
    return null;
  }
  const valid =
    typeof value === 'string' &&
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
  if (!valid) throw new HttpError(400, `${label} must be a date like 2026-10-31`);
  return value;
}

function readTerm(body = {}) {
  const term = {
    name: requireText(body.name, 'Name', { max: 80 }),
    startsOn: readDay(body.startsOn, 'Start date', { required: true }),
    endsOn: readDay(body.endsOn, 'End date', { required: true }),
  };
  if (term.endsOn < term.startsOn) throw new HttpError(400, 'The term must end after it starts');

  // Stages are done in order, so their due dates must be too. Catches a mistyped month.
  const deadlines = {};
  let previous = null;
  for (const [stage, label] of Object.entries(STAGES)) {
    const due = readDay(body.deadlines?.[stage], `${label} due date`, { required: false });
    if (!due) continue;
    if (previous && due < previous.due) {
      throw new HttpError(400, `${label} can't be due before ${previous.label}`);
    }
    deadlines[stage] = due;
    previous = { due, label };
  }
  return { term, deadlines, makeCurrent: body.isCurrent === true };
}

function assertNameFree(name, exceptId) {
  const existing = Term.findByName(name);
  if (existing && existing.id !== exceptId) throw new HttpError(409, `A term named "${name}" already exists`);
}

function loadTerm(rawId) {
  const term = Term.findById(parseId(rawId, 'Term not found'));
  if (!term) throw new HttpError(404, 'Term not found');
  return term;
}

export function listTerms(req, res) {
  res.json(Term.list());
}

export function createTerm(req, res) {
  const { term, deadlines, makeCurrent } = readTerm(req.body);
  assertNameFree(term.name);

  const id = transaction(() => {
    const created = Term.create(term);
    Term.setDeadlines(created, deadlines);
    // The first term is current straight away, so new theses have somewhere to go
    if (makeCurrent || !Term.findCurrent()) Term.makeCurrent(created);
    return created;
  });
  res.status(201).json(Term.findById(id));
}

export function updateTerm(req, res) {
  const existing = loadTerm(req.params.id);
  const { term, deadlines, makeCurrent } = readTerm(req.body);
  assertNameFree(term.name, existing.id);

  transaction(() => {
    Term.update(existing.id, term);
    Term.setDeadlines(existing.id, deadlines);
    if (makeCurrent) Term.makeCurrent(existing.id);
  });
  res.json(Term.findById(existing.id));
}

export function deleteTerm(req, res) {
  const term = loadTerm(req.params.id);
  if (term.thesis_count > 0) {
    throw new HttpError(
      409,
      `${term.thesis_count} ${term.thesis_count === 1 ? 'thesis is' : 'theses are'} in this term. Move them to another term first.`,
    );
  }
  Term.remove(term.id);
  res.status(204).end();
}
