import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { ChevronLeft, ChevronRight, FileText, MessageSquare, Pencil, Upload } from 'lucide-react';
import AdminControls from '../components/thesis/AdminControls.jsx';
import SubmissionForm from '../components/thesis/SubmissionForm.jsx';
import ThesisForm from '../components/thesis/ThesisForm.jsx';
import ActivityFeed from '../components/ui/ActivityFeed.jsx';
import Avatar from '../components/ui/Avatar.jsx';
import { SubmissionStatusBadge, ThesisStatusBadge } from '../components/ui/Badge.jsx';
import { Alert, EmptyState, LoadState } from '../components/ui/Feedback.jsx';
import Modal from '../components/ui/Modal.jsx';
import PageHeader from '../components/ui/PageHeader.jsx';
import StageTracker from '../components/ui/StageTracker.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import useApi from '../hooks/useApi.js';
import { api } from '../services/api.js';
import { STAGE_LABELS, STAGES } from '../utils/constants.js';
import { approvedStageKeys, formatDate, formatDateTime } from '../utils/format.js';

function Person({ label, name, detail }) {
  return (
    <div className="person">
      <Avatar name={name ?? '—'} />
      <div>
        <span className="person-label">{label}</span>
        <strong>{name ?? 'Not assigned'}</strong>
        {detail && <span className="muted">{detail}</span>}
      </div>
    </div>
  );
}

export default function ThesisDetail({ thesisId }) {
  const params = useParams();
  const id = thesisId ?? params.id;
  const { user } = useAuth();
  const { data, loading, error, reload } = useApi(() => api.getThesis(id), [id]);
  const [modal, setModal] = useState(null);

  if (!data) return <LoadState loading={loading} error={error} />;
  const { thesis, submissions, activity } = data;

  const isStudent = user.role === 'student';
  const isAdmin = user.role === 'admin';
  const approved = approvedStageKeys(thesis);
  const hasPending = submissions.some((s) => s.status === 'pending');
  const openStages = STAGES.filter((stage) => !approved.includes(stage.key));
  const canEdit = isAdmin || (isStudent && thesis.status !== 'completed');
  const canSubmit = isStudent && thesis.status !== 'completed' && !hasPending && openStages.length > 0;
  const keywords = thesis.keywords.split(',').map((k) => k.trim()).filter(Boolean);

  const closeModal = () => setModal(null);

  return (
    <>
      <PageHeader
        eyebrow={
          !isStudent && (
            <Link to="/theses" className="back-link">
              <ChevronLeft size={16} />
              {isAdmin ? 'All theses' : 'My advisees'}
            </Link>
          )
        }
        title={thesis.title}
        subtitle={
          <span className="header-meta">
            <ThesisStatusBadge status={thesis.status} />
            <span>Started {formatDate(thesis.created_at)}</span>
          </span>
        }
        actions={
          <>
            {canEdit && (
              <button type="button" className="btn btn-secondary" onClick={() => setModal('edit')}>
                <Pencil size={16} />
                Edit details
              </button>
            )}
            {isStudent && (
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => setModal('submit')}
                disabled={!canSubmit}
                title={hasPending ? 'Wait for your adviser to review your pending submission' : undefined}
              >
                <Upload size={16} />
                New submission
              </button>
            )}
          </>
        }
      />

      <div className="detail-layout">
        <div className="stack">
          {isStudent && hasPending && (
            <Alert tone="info" title="Submission under review">
              You can upload your next submission after your adviser reviews the current one.
            </Alert>
          )}

          <section className="card">
            <div className="card-header">
              <h3>Progress</h3>
              <span className="muted">
                {approved.length} of {STAGES.length} stages approved
              </span>
            </div>
            <StageTracker approvedKeys={approved} />
          </section>

          <section className="card">
            <div className="card-header">
              <h3>Abstract</h3>
            </div>
            {thesis.abstract ? <p className="prose">{thesis.abstract}</p> : <p className="muted">No abstract yet.</p>}
            {keywords.length > 0 && (
              <div className="chips">
                {keywords.map((keyword) => (
                  <span key={keyword} className="chip">
                    {keyword}
                  </span>
                ))}
              </div>
            )}
          </section>

          <section className="card card-flush">
            <div className="card-header card-pad">
              <h3>Submissions</h3>
              <span className="muted">{submissions.length} total</span>
            </div>
            {submissions.length ? (
              <ul className="submission-list">
                {submissions.map((submission) => (
                  <li key={submission.id}>
                    <Link to={`/submissions/${submission.id}`} className="submission-item">
                      <div className="file-icon">
                        <FileText size={20} />
                      </div>
                      <div className="row-main">
                        <strong>{STAGE_LABELS[submission.stage]}</strong>
                        <span className="muted clamp-1">
                          {submission.file_name ?? 'No file attached'} · {formatDateTime(submission.submitted_at)}
                        </span>
                      </div>
                      {submission.comment_count > 0 && (
                        <span className="comment-count" title={`${submission.comment_count} comments`}>
                          <MessageSquare size={14} />
                          {submission.comment_count}
                        </span>
                      )}
                      <SubmissionStatusBadge status={submission.status} />
                      <ChevronRight size={18} className="muted hide-mobile" />
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState
                compact
                icon={Upload}
                title="No submissions yet"
                message={isStudent ? 'Start by submitting your proposal.' : 'The student has not submitted anything yet.'}
              />
            )}
          </section>
        </div>

        <aside className="stack">
          <section className="card">
            <div className="card-header">
              <h3>People</h3>
            </div>
            <div className="people">
              <Person label="Student" name={thesis.student_name} detail={thesis.student_program || thesis.student_email} />
              <Person label="Adviser" name={thesis.adviser_name} detail={thesis.adviser_email} />
            </div>
          </section>

          {isAdmin && <AdminControls thesis={thesis} onChanged={reload} />}

          <section className="card">
            <div className="card-header">
              <h3>Activity</h3>
            </div>
            <ActivityFeed items={activity} />
          </section>
        </aside>
      </div>

      <Modal open={modal === 'edit'} title="Edit thesis details" onClose={closeModal} size="lg">
        <ThesisForm
          initial={thesis}
          submitLabel="Save changes"
          onCancel={closeModal}
          onSubmit={async (values) => {
            await api.updateThesis(thesis.id, values);
            closeModal();
            reload();
          }}
        />
      </Modal>

      <Modal
        open={modal === 'submit'}
        title="New submission"
        description="Your adviser will be able to download the file and leave feedback."
        onClose={closeModal}
      >
        <SubmissionForm
          stages={openStages}
          onCancel={closeModal}
          onSubmit={async (formData) => {
            await api.createSubmission(thesis.id, formData);
            closeModal();
            reload();
          }}
        />
      </Modal>
    </>
  );
}
