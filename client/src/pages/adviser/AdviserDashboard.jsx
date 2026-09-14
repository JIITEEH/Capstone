import { Link } from 'react-router';
import { ArrowRight, CircleCheck, Clock, Inbox, TriangleAlert, Users } from 'lucide-react';
import ActivityFeed from '../../components/ui/ActivityFeed.jsx';
import Avatar from '../../components/ui/Avatar.jsx';
import { ThesisStatusBadge } from '../../components/ui/Badge.jsx';
import { EmptyState, LoadState } from '../../components/ui/Feedback.jsx';
import PageHeader from '../../components/ui/PageHeader.jsx';
import { ProgressBar } from '../../components/ui/StageTracker.jsx';
import StatCard from '../../components/ui/StatCard.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import useApi from '../../hooks/useApi.js';
import { api } from '../../services/api.js';
import { STAGE_LABELS, STAGES } from '../../utils/constants.js';
import { timeAgo } from '../../utils/format.js';

export default function AdviserDashboard() {
  const { user } = useAuth();
  const { data, loading, error } = useApi(() => api.dashboard(), []);

  if (!data) return <LoadState loading={loading} error={error} />;
  const { stats, pending, theses, activity } = data;

  return (
    <>
      <PageHeader title={`Good day, ${user.name}`} subtitle="Review submissions and follow your advisees' progress." />

      <div className="stack">
        <div className="stat-grid">
          <StatCard icon={Users} tone="primary" label="Advisees" value={stats.advisees} />
          <StatCard icon={Clock} tone="info" label="Awaiting your review" value={stats.pendingReviews} />
          <StatCard icon={TriangleAlert} tone="warning" label="Revising" value={stats.needsRevision} />
          <StatCard icon={CircleCheck} tone="success" label="Completed" value={stats.completed} />
        </div>

        <section className="card">
          <div className="card-header">
            <h3>Review queue</h3>
            <span className="muted">Oldest first</span>
          </div>
          {pending.length ? (
            <ul className="row-list">
              {pending.map((item) => (
                <li key={item.id} className="row-item">
                  <Avatar name={item.student_name} />
                  <div className="row-main">
                    <strong>{item.student_name}</strong>
                    <span className="muted clamp-1">
                      {STAGE_LABELS[item.stage]} · {item.thesis_title}
                    </span>
                  </div>
                  <span className="row-meta">{timeAgo(item.submitted_at)}</span>
                  <Link to={`/submissions/${item.id}`} className="btn btn-primary btn-sm">
                    Review
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState compact icon={Inbox} title="You're all caught up" message="New submissions from your advisees will appear here." />
          )}
        </section>

        <div className="grid-2">
          <section className="card">
            <div className="card-header">
              <h3>My advisees</h3>
              <Link to="/theses" className="card-link">
                View all <ArrowRight size={14} />
              </Link>
            </div>
            {theses.length ? (
              <ul className="row-list">
                {theses.slice(0, 6).map((thesis) => (
                  <li key={thesis.id}>
                    <Link to={`/theses/${thesis.id}`} className="row-item row-link">
                      <div className="row-main">
                        <strong>{thesis.student_name}</strong>
                        <span className="muted clamp-1">{thesis.title}</span>
                        <ProgressBar value={thesis.approved_stages} max={STAGES.length} />
                      </div>
                      <ThesisStatusBadge status={thesis.status} />
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState compact icon={Users} title="No advisees yet" message="An administrator assigns students to you." />
            )}
          </section>

          <section className="card">
            <div className="card-header">
              <h3>Recent activity</h3>
            </div>
            <ActivityFeed items={activity} showThesis />
          </section>
        </div>
      </div>
    </>
  );
}
