import { Link } from 'react-router';
import { ArrowRight, BookOpen, CircleCheck, Clock, FileText, MessageSquare, Plus } from 'lucide-react';
import ActivityFeed from '../../components/ui/ActivityFeed.jsx';
import Avatar from '../../components/ui/Avatar.jsx';
import { ThesisStatusBadge } from '../../components/ui/Badge.jsx';
import { Alert, EmptyState, LoadState } from '../../components/ui/Feedback.jsx';
import PageHeader from '../../components/ui/PageHeader.jsx';
import StageTracker from '../../components/ui/StageTracker.jsx';
import StatCard from '../../components/ui/StatCard.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import useApi from '../../hooks/useApi.js';
import { api } from '../../services/api.js';
import { STAGE_LABELS, STAGES } from '../../utils/constants.js';
import { approvedStageKeys, timeAgo } from '../../utils/format.js';

function NextStep({ thesis }) {
  if (!thesis.adviser_id) {
    return (
      <Alert tone="info" title="Waiting for an adviser">
        An administrator will assign your adviser. You can still submit your proposal in the meantime.
      </Alert>
    );
  }
  if (thesis.status === 'revisions_required') {
    return (
      <Alert tone="warning" title="Revisions requested">
        Your adviser left feedback on your latest submission. Review it and submit an updated version.
      </Alert>
    );
  }
  if (thesis.status === 'completed') {
    return (
      <Alert tone="success" title="Thesis completed">
        Every stage has been approved. Congratulations!
      </Alert>
    );
  }
  return null;
}

export default function StudentDashboard() {
  const { user } = useAuth();
  const { data, loading, error } = useApi(() => api.dashboard(), []);
  const firstName = user.name.split(' ')[0];

  if (!data) return <LoadState loading={loading} error={error} />;
  const { thesis, stats, feedback, activity } = data;

  return (
    <>
      <PageHeader title={`Welcome back, ${firstName}`} subtitle="Track your thesis progress and your adviser's feedback." />

      {!thesis ? (
        <section className="card">
          <EmptyState
            icon={BookOpen}
            title="You haven't started your thesis yet"
            message="Add your thesis title and abstract to start submitting your proposal and chapters."
            action={
              <Link className="btn btn-primary" to="/thesis">
                <Plus size={16} />
                Start my thesis
              </Link>
            }
          />
        </section>
      ) : (
        <div className="stack">
          <NextStep thesis={thesis} />

          <section className="card thesis-hero">
            <div className="thesis-hero-head">
              <div>
                <span className="eyebrow">My thesis</span>
                <h2>{thesis.title}</h2>
                <p className="muted">
                  {thesis.adviser_name ? `Adviser: ${thesis.adviser_name}` : 'Adviser not yet assigned'}
                </p>
              </div>
              <ThesisStatusBadge status={thesis.status} />
            </div>
            <StageTracker approvedKeys={approvedStageKeys(thesis)} />
            <div className="card-actions">
              <Link to="/thesis" className="btn btn-primary">
                Open my thesis
                <ArrowRight size={16} />
              </Link>
            </div>
          </section>

          <div className="stat-grid">
            <StatCard icon={CircleCheck} tone="success" label="Stages approved" value={`${stats.approvedStages}/${STAGES.length}`} />
            <StatCard icon={Clock} tone="info" label="Awaiting review" value={stats.pending} />
            <StatCard icon={FileText} tone="primary" label="Total submissions" value={stats.submissions} />
            <StatCard icon={MessageSquare} tone="warning" label="Feedback received" value={stats.feedback} />
          </div>

          <div className="grid-2">
            <section className="card">
              <div className="card-header">
                <h3>Latest feedback</h3>
              </div>
              {feedback.length ? (
                <ul className="feedback-list">
                  {feedback.map((item) => (
                    <li key={item.id}>
                      <Link to={`/submissions/${item.submission_id}`} className="feedback-item">
                        <Avatar name={item.author_name ?? 'Deleted user'} size="sm" />
                        <div>
                          <div className="feedback-meta">
                            <strong>{item.author_name ?? 'Deleted user'}</strong>
                            <span>
                              {STAGE_LABELS[item.stage]} · {timeAgo(item.created_at)}
                            </span>
                          </div>
                          <p className="clamp-2">{item.body}</p>
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyState compact icon={MessageSquare} title="No feedback yet" message="Comments from your adviser will show up here." />
              )}
            </section>

            <section className="card">
              <div className="card-header">
                <h3>Recent activity</h3>
              </div>
              <ActivityFeed items={activity} />
            </section>
          </div>
        </div>
      )}
    </>
  );
}
