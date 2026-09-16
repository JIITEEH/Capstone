import { Link } from 'react-router';
import { ClipboardCheck, Inbox, Users } from 'lucide-react';
import DashboardHeader from '../../ui-pieces/dashboard/DashboardHeader.jsx';
import PeopleCard, { thesisStatusPill } from '../../ui-pieces/dashboard/PeopleCard.jsx';
import ProgressGauge, { groupStatuses } from '../../ui-pieces/dashboard/ProgressGauge.jsx';
import TaskListCard, { STAGE_GLYPHS } from '../../ui-pieces/dashboard/TaskListCard.jsx';
import WeeklyActivity from '../../ui-pieces/dashboard/WeeklyActivity.jsx';
import { LoadState } from '../../ui-pieces/basics/Feedback.jsx';
import StatCard from '../../ui-pieces/basics/StatCard.jsx';
import { useAuth } from '../../shared-state/AuthContext.jsx';
import useApi from '../../reusable-logic/useApi.js';
import { api } from '../../api-client/api.js';
import { STAGE_LABELS } from '../../helpers/constants.js';
import { formatDate, greeting, parseDate, plural } from '../../helpers/format.js';

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export default function AdviserDashboard() {
  const { user } = useAuth();
  const { data, loading, error, reload } = useApi(() => api.dashboard(), [], { refreshInterval: 30000 });

  if (!data) return <LoadState loading={loading} error={error} onRetry={reload} />;
  const { stats, pending, theses, weeklyActivity } = data;

  const newThisWeek = pending.filter((item) => Date.now() - parseDate(item.submitted_at).getTime() < WEEK_MS).length;
  const completedShare = stats.advisees ? Math.round((stats.completed / stats.advisees) * 100) : 0;
  const statusCounts = {};
  for (const thesis of theses) statusCounts[thesis.status] = (statusCounts[thesis.status] ?? 0) + 1;
  const segments = groupStatuses(statusCounts);

  return (
    <div className="dashboard">
      <DashboardHeader
        subtitle={`${greeting()}, ${user.name}. ${
          pending.length
            ? `You have ${plural(pending.length, 'submission')} waiting for your review.`
            : "You're all caught up on reviews."
        }`}
      >
        {pending.length > 0 ? (
          <Link to={`/submissions/${pending[0].id}`} className="btn btn-primary btn-lg">
            <ClipboardCheck size={20} />
            Start Reviewing
          </Link>
        ) : (
          <Link to="/theses" className="btn btn-primary btn-lg">
            <Users size={20} />
            View Advisees
          </Link>
        )}
        <Link to="/schedule" className="btn btn-outline btn-lg">
          My Schedule
        </Link>
      </DashboardHeader>

      <div className="kpi-grid stagger">
        <StatCard
          featured
          label="Total Advisees"
          value={stats.advisees}
          to="/theses"
          chip={stats.completed}
          note="Completed their thesis"
        />
        <StatCard
          label="Awaiting Review"
          value={stats.pendingReviews}
          to={pending.length ? `/submissions/${pending[0].id}` : '/theses'}
          chip={newThisWeek}
          trend={newThisWeek > 0}
          note="Submitted this week"
        />
        <StatCard
          label="Needs Revisions"
          value={stats.needsRevision}
          to="/theses?status=revisions_required"
          note="Waiting on student updates"
        />
        <StatCard
          label="Completed"
          value={stats.completed}
          to="/theses?status=completed"
          note={`${completedShare}% of your advisees`}
        />
      </div>

      <div className="dash-grid">
        <div className="dash-main">
          <div className="dash-row dash-row-top stagger">
            <WeeklyActivity timestamps={weeklyActivity} title="Advisee Activity" />          </div>
          <div className="dash-row dash-row-bottom stagger">
            <PeopleCard
              title="My Advisees"
              action={
                <Link to="/theses" className="pill-btn">
                  View All
                </Link>
              }
              people={theses.slice(0, 4).map((thesis) => ({
                key: thesis.id,
                name: thesis.student_name,
                lead: 'Working on',
                detail: thesis.title,
                status: thesisStatusPill(thesis.status),
                to: `/theses/${thesis.id}`,
              }))}
              emptyIcon={Users}
              emptyTitle="No advisees yet"
              emptyMessage="An administrator assigns students to you."
            />
            <ProgressGauge
              title="Advisee Progress"
              {...segments}
              caption="Advisees Completed"
              labels={['Completed', 'In Progress', 'Draft']}
            />
          </div>
        </div>

        <div className="dash-side stagger">
          <TaskListCard
            title="Review Queue"
            action={
              <Link to="/theses" className="pill-btn">
                View All
              </Link>
            }
            items={pending.slice(0, 5).map((item) => ({
              key: item.id,
              ...STAGE_GLYPHS[item.stage],
              title: item.student_name,
              meta: `${STAGE_LABELS[item.stage]} · ${formatDate(item.submitted_at)}`,
              to: `/submissions/${item.id}`,
            }))}
            emptyIcon={Inbox}
            emptyTitle="You're all caught up"
            emptyMessage="New submissions from your advisees will appear here."
          />
        </div>
      </div>
    </div>
  );
}
