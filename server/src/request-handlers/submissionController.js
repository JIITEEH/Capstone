import fs from 'node:fs';
import { REVIEW_DECISIONS, STAGES } from '../constants.js';
import { transaction } from '../database/index.js';
import * as Activity from '../database-queries/activityModel.js';
import * as Comment from '../database-queries/commentModel.js';
import * as Review from '../database-queries/reviewModel.js';
import * as Submission from '../database-queries/submissionModel.js';
import * as Thesis from '../database-queries/thesisModel.js';
import { canViewThesis } from '../permission-rules/access.js';
import { storedFilePath } from '../helpers/files.js';
import { HttpError } from '../helpers/httpError.js';
import { oneOf, optionalText, parseId, requireText } from '../helpers/validate.js';

function loadSubmission(user, rawId) {
  const submission = Submission.findById(parseId(rawId, 'Submission not found'));
  const thesis = submission && Thesis.findById(submission.thesis_id);
  if (!canViewThesis(user, thesis)) throw new HttpError(404, 'Submission not found');
  return { submission, thesis };
}

export function getSubmission(req, res) {
  const { submission, thesis } = loadSubmission(req.user, req.params.id);
  res.json({ submission, thesis, comments: Comment.listBySubmission(submission.id) });
}

export function reviewSubmission(req, res) {
  const { submission, thesis } = loadSubmission(req.user, req.params.id);
  const body = req.body ?? {};
  const decision = oneOf(body.decision, REVIEW_DECISIONS, 'decision');
  const feedback =
    decision === 'revisions_requested'
      ? requireText(body.feedback, 'An explanation of the revisions', { max: 3000 })
      : optionalText(body.feedback, 'Feedback', { max: 3000 });

  if (submission.status !== 'pending') throw new HttpError(400, 'This submission has already been reviewed');

  const stage = STAGES[submission.stage];
  const updated = transaction(() => {
    Review.create({ submissionId: submission.id, reviewerId: req.user.id, decision, feedback });
    Thesis.recomputeStatus(thesis.id);
    Activity.log(
      thesis.id,
      req.user.id,
      decision === 'approved' ? `approved ${stage}` : `requested revisions on ${stage}`,
    );
    return Submission.findById(submission.id);
  });
  res.json(updated);
}

export function addComment(req, res) {
  const { submission, thesis } = loadSubmission(req.user, req.params.id);
  const body = requireText(req.body?.body, 'Comment', { max: 3000 });

  const comment = transaction(() => {
    const created = Comment.create({ submissionId: submission.id, authorId: req.user.id, body });
    Activity.log(thesis.id, req.user.id, `commented on ${STAGES[submission.stage]}`);
    return created;
  });
  res.status(201).json(comment);
}

export function downloadFile(req, res) {
  const { submission } = loadSubmission(req.user, req.params.id);
  const storedName = Submission.getStoredName(submission.id);
  if (!storedName) throw new HttpError(404, 'No file is attached to this submission');

  const filePath = storedFilePath(storedName);
  if (!fs.existsSync(filePath)) throw new HttpError(404, 'The file could not be found');
  res.download(filePath, submission.file_name);
}
