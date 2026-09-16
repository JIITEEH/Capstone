import { useState } from 'react';
import { Link, useParams } from 'react-router';
import {
  Check,
  ChevronLeft,
  CircleCheck,
  Clock,
  Download,
  FileText,
  Lock,
  MessageSquare,
  RotateCcw,
  Send,
} from 'lucide-react';
import Avatar from '../ui-pieces/basics/Avatar.jsx';
import { RoleBadge, SubmissionStatusBadge } from '../ui-pieces/basics/Badge.jsx';
import { EmptyState, LoadState } from '../ui-pieces/basics/Feedback.jsx';
import PageHeader from '../ui-pieces/basics/PageHeader.jsx';
import { useAuth } from '../shared-state/AuthContext.jsx';
import { useToast } from '../shared-state/ToastContext.jsx';
import useApi from '../reusable-logic/useApi.js';
import { api } from '../api-client/api.js';
import { STAGE_LABELS } from '../helpers/constants.js';
import { formatBytes, formatDateTime, plural, timeAgo } from '../helpers/format.js';

function ReviewPanel({ submissionId, studentName, onReviewed }) {
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');

  async function review(decision) {
    if (decision === 'revisions_requested' && !note.trim()) {
      return setError('Explain what the student needs to revise.');
    }
    setBusy(decision);
    setError('');
    try {
      await api.reviewSubmission(submissionId, { decision, feedback: note });
      await onReviewed(decision);
    } catch (err) {
      setError(err.message);
      setBusy('');
    }
  }

  return (
    <section className="card review-panel">
      <div className="card-header">
        <h3>Your review</h3>
      </div>
      <div className="form">
        <p className="muted">Decide whether {studentName} can move on to the next stage.</p>
        <div className="field">
          <label htmlFor="review-note">Feedback for the student</label>
          <textarea
            id="review-note"
            className="input"
            rows={5}
            maxLength={3000}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Optional when approving. Required when requesting revisions."
          />
        </div>
        {error && <p className="form-error">{error}</p>}
        <div className="review-actions">
          <button type="button" className="btn btn-warning" onClick={() => review('revisions_requested')} disabled={Boolean(busy)}>
            <RotateCcw size={16} />
            {busy === 'revisions_requested' ? 'Sending…' : 'Request revisions'}
          </button>
          <button type="button" className="btn btn-success" onClick={() => review('approved')} disabled={Boolean(busy)}>
            <Check size={16} />
            {busy === 'approved' ? 'Approving…' : 'Approve'}
          </button>
        </div>
      </div>
    </section>
  );
}

function ReviewResult({ submission }) {
  const approved = submission.status === 'approved';
  const Icon = approved ? CircleCheck : RotateCcw;
  return (
    <section className={`card review-result review-${submission.status}`}>
      <div className="review-result-head">
        <span className={`review-result-icon tone-${approved ? 'success' : 'warning'}`}>
          <Icon size={20} />
        </span>
        <div>
          <strong>{approved ? 'Approved' : 'Revisions requested'}</strong>
          <span className="muted">
            {submission.reviewer_name ?? 'Deleted user'} · {formatDateTime(submission.reviewed_at)}
          </span>
        </div>
      </div>
      {submission.review_feedback ? (
        <p className="prose">{submission.review_feedback}</p>
      ) : (
        <p className="muted">No additional feedback was left.</p>
      )}
    </section>
  );
}

function CommentForm({ submissionId, onPosted }) {
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(event) {
    event.preventDefault();
    if (!body.trim()) return;
    setBusy(true);
    setError('');
    try {
      await api.addComment(submissionId, body);
      setBody('');
      await onPosted();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="comment-form" onSubmit={handleSubmit}>
      <textarea
        className="input"
        rows={3}
        maxLength={3000}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Write a comment…"
        aria-label="Comment"
      />
      {error && <p className="form-error">{error}</p>}
      <div className="form-actions">
        <button type="submit" className="btn btn-primary" disabled={busy || !body.trim()}>
          <Send size={16} />
          {busy ? 'Posting…' : 'Post comment'}
        </button>
      </div>
    </form>
  );
}

export default function SubmissionDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const toast = useToast();
  const { data, loading, error, reload } = useApi(() => api.getSubmission(id), [id]);

  if (!data) return <LoadState loading={loading} error={error} onRetry={reload} />;
  const { submission, thesis, comments } = data;

  const isAdmin = user.role === 'admin';
  // Only the assigned adviser reviews; the API returns 404 to other advisers before this page loads
  const canReview = submission.status === 'pending' && user.role === 'adviser';
  const backTo = user.role === 'student' ? '/thesis' : `/theses/${thesis.id}`;

  async function download() {
    try {
      await api.downloadSubmission(submission.id, submission.file_name);
    } catch (err) {
      toast.error(err.message);
    }
  }

  return (
    <>
      <PageHeader
        eyebrow={
          <Link to={backTo} className="back-link">
            <ChevronLeft size={16} />
            {user.role === 'student' ? 'My thesis' : thesis.student_name}
          </Link>
        }
        title={STAGE_LABELS[submission.stage]}
        subtitle={
          <span className="header-meta">
            <SubmissionStatusBadge status={submission.status} />
            <span className="clamp-1">{thesis.title}</span>
          </span>
        }
      />

      <div className="detail-layout">
        <div className="stack stagger">
          <section className="card">
            <div className="file-card">
              <div className="file-icon file-icon-lg">
                <FileText size={26} />
              </div>
              <div className="row-main">
                <strong className="clamp-1">{submission.file_name ?? 'No file attached'}</strong>
                <span className="muted">
                  {submission.has_file ? `${formatBytes(submission.file_size)} · ` : ''}Submitted{' '}
                  {formatDateTime(submission.submitted_at)}
                </span>
              </div>
              {submission.has_file ? (
                <button type="button" className="btn btn-secondary" onClick={download}>
                  <Download size={16} />
                  Download
                </button>
              ) : null}
            </div>
            {submission.notes && (
              <div className="notes">
                <span className="person-label">Notes from the student</span>
                <p className="prose">{submission.notes}</p>
              </div>
            )}
          </section>

          {submission.status !== 'pending' && <ReviewResult submission={submission} />}

          <section className="card">
            <div className="card-header">
              <h3>Discussion</h3>
              <span className="muted">{plural(comments.length, 'comment')}</span>
            </div>
            {comments.length ? (
              <ul className="comment-list stagger">
                {comments.map((comment) => (
                  <li key={comment.id} className={`comment${comment.author_id === user.id ? ' comment-own' : ''}`}>
                    <Avatar name={comment.author_name ?? 'Deleted user'} size="sm" />
                    <div className="comment-body">
                      <div className="comment-meta">
                        <strong>{comment.author_name ?? 'Deleted user'}</strong>
                        {comment.author_role && <RoleBadge role={comment.author_role} />}
                        <span className="muted" title={formatDateTime(comment.created_at)}>
                          {timeAgo(comment.created_at)}
                        </span>
                      </div>
                      <p className="prose">{comment.body}</p>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState compact icon={MessageSquare} title="No comments yet" />
            )}
            {isAdmin ? (
              <p className="read-only-note muted">
                <Lock size={14} />
                Admins can read this discussion. Only the student and adviser can post.
              </p>
            ) : (
              <CommentForm
                submissionId={submission.id}
                onPosted={async () => {
                  toast.success('Comment posted');
                  await reload();
                }}
              />
            )}
          </section>
        </div>

        <aside className="stack stagger">
          {canReview && (
            <ReviewPanel
              submissionId={submission.id}
              studentName={thesis.student_name}
              onReviewed={async (decision) => {
                toast.success(decision === 'approved' ? 'Submission approved' : 'Revisions requested');
                await reload();
              }}
            />
          )}

          {submission.status === 'pending' && !canReview && (
            <section className="card waiting-card">
              <span className="review-result-icon tone-info">
                <Clock size={20} />
              </span>
              <div>
                <strong>Waiting for review</strong>
                <span className="muted">
                  {thesis.adviser_name
                    ? `${thesis.adviser_name} will review this submission.`
                    : 'An adviser needs to be assigned first.'}
                </span>
              </div>
            </section>
          )}

          <section className="card">
            <div className="card-header">
              <h3>Details</h3>
            </div>
            <dl className="details">
              <div>
                <dt>{thesis.member_count > 1 ? 'Students' : 'Student'}</dt>
                <dd>{thesis.student_name}</dd>
              </div>
              <div>
                <dt>Adviser</dt>
                <dd>{thesis.adviser_name ?? 'Not assigned'}</dd>
              </div>
              <div>
                <dt>Stage</dt>
                <dd>{STAGE_LABELS[submission.stage]}</dd>
              </div>
              <div>
                <dt>Status</dt>
                <dd>
                  <SubmissionStatusBadge status={submission.status} />
                </dd>
              </div>
            </dl>
          </section>
        </aside>
      </div>
    </>
  );
}
