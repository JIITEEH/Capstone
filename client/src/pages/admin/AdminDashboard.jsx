import { Link } from 'react-router';
import { ArrowRight, CircleCheck, Clock, GraduationCap, Library, UserRoundX, Users } from 'lucide-react';
import ActivityFeed from '../../components/ui/ActivityFeed.jsx';
import Avatar from '../../components/ui/Avatar.jsx';
import { EmptyState, LoadState } from '../../components/ui/Feedback.jsx';
import PageHeader from '../../components/ui/PageHeader.jsx';
import StatCard from '../../components/ui/StatCard.jsx';
import useApi from '../../hooks/useApi.js';
import { api } from '../../services/api.js';
import { THESIS_STATUS } from '../../utils/constants.js';
import { timeAgo } from '../../utils/format.js';

export default function AdminDashboard() {
  const { data, loading, error } = useApi(() => api.dashboard(), []);

  if (!data) return <LoadState loading={loading} error={error} />;
  const { stats, statusBreakdown, advisers, unassigned, activity } = data;

  const counts = Object.fromEntries(statusBreakdown.map((row) => [row.status, row.count]));
  const maxLoad = Math.max(1, ...advisers.map((adviser) => adviser.advisee_count));

  return (
    <>
      <PageHeader
        title="Administration"
        subtitle="An overview of every thesis, adviser, and student in the system."
        actions={
          <Link to="/users" className="btn btn-primary">
            <Users size={16} />
            Manage users
          </Link>
        }
      />

      <div className="stack">
        <div className="stat-grid stat-grid-6">
          <StatCard icon={GraduationCap} tone="info" label="Students" value={stats.students} />
          <StatCard icon={Users} tone="primary" label="Advisers" value={stats.advisers} />
          <StatCard icon={Library} tone="neutral" label="Theses" value={stats.theses} />
          <StatCard icon={UserRoundX} tone="danger" label="Without adviser" value={stats.unassigned} />
          <StatCard icon={Clock} tone="warning" label="Pending reviews" value={stats.pending_reviews} />
          <StatCard icon={CircleCheck} tone="success" label="Completed" value={stats.completed} />
        </div>

        <div className="grid-2">
          <section className="card">
            <div className="card-header">
              <h3>Theses by status</h3>
              <Link to="/theses" className="card-link">
                View all <ArrowRight size={14} />
              </Link>
            </div>
            <ul className="bar-list">
              {Object.entries(THESIS_STATUS).map(([key, info]) => {
                const count = counts[key] ?? 0;
                return (
                  <li key={key}>
                    <Link to={`/theses?status=${key}`} className="bar-row">
                      <span className="bar-label">{info.label}</span>
                      <span className="bar-track">
                        <span
                          className={`bar-fill tone-${info.tone}`}
                          style={{ width: `${stats.theses ? (count / stats.theses) * 100 : 0}%` }}
                        />
                      </span>
                      <span className="bar-value">{count}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>

          <section className="card">
            <div className="card-header">
              <h3>Adviser workload</h3>
            </div>
            {advisers.length ? (
              <ul className="bar-list">
                {advisers.map((adviser) => (
                  <li key={adviser.id} className="bar-row">
                    <span className="bar-label bar-label-person">
                      <Avatar name={adviser.name} size="sm" />
                      <span className="clamp-1">{adviser.name}</span>
                    </span>
                    <span className="bar-track">
                      <span className="bar-fill tone-primary" style={{ width: `${(adviser.advisee_count / maxLoad) * 100}%` }} />
                    </span>
                    <span className="bar-value" title={`${adviser.pending_count} pending reviews`}>
                      {adviser.advisee_count}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState compact icon={Users} title="No advisers yet" />
            )}
          </section>
        </div>

        <div className="grid-2">
          <section className="card">
            <div className="card-header">
              <h3>Needs an adviser</h3>
              {stats.unassigned > 0 && (
                <Link to="/theses?adviser=unassigned" className="card-link">
                  View all <ArrowRight size={14} />
                </Link>
              )}
            </div>
            {unassigned.length ? (
              <ul className="row-list">
                {unassigned.map((thesis) => (
                  <li key={thesis.id} className="row-item">
                    <Avatar name={thesis.student_name} />
                    <div className="row-main">
                      <strong>{thesis.student_name}</strong>
                      <span className="muted clamp-1">{thesis.title}</span>
                    </div>
                    <span className="row-meta">{timeAgo(thesis.created_at)}</span>
                    <Link to={`/theses/${thesis.id}`} className="btn btn-secondary btn-sm">
                      Assign
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState compact icon={CircleCheck} title="Every thesis has an adviser" />
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
