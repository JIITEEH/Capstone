import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { Check, ChevronLeft, Download, FileText, MessageSquare, RotateCcw, Send } from 'lucide-react';
import Avatar from '../components/ui/Avatar.jsx';
import { RoleBadge, SubmissionStatusBadge } from '../components/ui/Badge.jsx';
import { EmptyState, LoadState } from '../components/ui/Feedback.jsx';
import PageHeader from '../components/ui/PageHeader.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import useApi from '../hooks/useApi.js';
import { api } from '../services/api.js';
import { STAGE_LABELS } from '../utils/constants.js';
import { formatBytes, formatDateTime, plural, timeAgo } from '../utils/format.js';

function ReviewPanel({ submissionId, onReviewed }) {
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
      await api.reviewSubmission(submissionId, { decision, comment: note });
      await onReviewed();
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
  const { data, loading, error, reload } = useApi(() => api.getSubmission(id), [id]);
  const [downloadError, setDownloadError] = useState('');

  if (!data) return <LoadState loading={loading} error={error} />;
  const { submission, thesis, comments } = data;

  const canReview = submission.status === 'pending' && (user.role === 'admin' || user.role === 'adviser');
  const backTo = user.role === 'student' ? '/thesis' : `/theses/${thesis.id}`;

  async function download() {
    setDownloadError('');
    try {
      await api.downloadSubmission(submission.id, submission.file_name);
    } catch (err) {
      setDownloadError(err.message);
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
        <div className="stack">
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
            {downloadError && <p className="form-error">{downloadError}</p>}
            {submission.notes && (
              <div className="notes">
                <span className="person-label">Notes from the student</span>
                <p className="prose">{submission.notes}</p>
              </div>
            )}
          </section>

          <section className="card">
            <div className="card-header">
              <h3>Discussion</h3>
              <span className="muted">{plural(comments.length, 'comment')}</span>
            </div>
            {comments.length ? (
              <ul className="comment-list">
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
            <CommentForm submissionId={submission.id} onPosted={reload} />
          </section>
        </div>

        <aside className="stack">
          {canReview && <ReviewPanel submissionId={submission.id} onReviewed={reload} />}

          <section className="card">
            <div className="card-header">
              <h3>Details</h3>
            </div>
            <dl className="details">
              <div>
                <dt>Student</dt>
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
              {submission.reviewed_at && (
                <div>
                  <dt>Reviewed</dt>
                  <dd>
                    {formatDateTime(submission.reviewed_at)}
                    {submission.reviewer_name && <span className="muted"> by {submission.reviewer_name}</span>}
                  </dd>
                </div>
              )}
            </dl>
          </section>
        </aside>
      </div>
    </>
  );
}
