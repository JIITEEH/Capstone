import { Link } from 'react-router';
import { BookOpen, CircleCheck, FileText, GraduationCap, Plus, ScrollText, Users } from 'lucide-react';
import DashboardHeader from '../../components/dashboard/DashboardHeader.jsx';
import PeopleCard from '../../components/dashboard/PeopleCard.jsx';
import ProgressGauge, { groupStatuses } from '../../components/dashboard/ProgressGauge.jsx';
import TaskListCard from '../../components/dashboard/TaskListCard.jsx';
import TimeTracker from '../../components/dashboard/TimeTracker.jsx';
import WeeklyActivity from '../../components/dashboard/WeeklyActivity.jsx';
import { LoadState } from '../../components/ui/Feedback.jsx';
import StatCard from '../../components/ui/StatCard.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import useApi from '../../hooks/useApi.js';
import { api } from '../../services/api.js';
import { formatDate, greeting, plural } from '../../utils/format.js';

const THESIS_GLYPHS = [
  { icon: ScrollText, tone: 'blue' },
  { icon: BookOpen, tone: 'teal' },
  { icon: FileText, tone: 'amber' },
  { icon: GraduationCap, tone: 'violet' },
  { icon: BookOpen, tone: 'rose' },
];

function summary(stats) {
  const parts = [];
  if (stats.unassigned) parts.push(stats.unassigned === 1 ? '1 thesis needs an adviser' : `${stats.unassigned} theses need an adviser`);
  if (stats.pending_reviews) parts.push(`${plural(stats.pending_reviews, 'submission')} awaiting review`);
  return parts.length ? `${parts.join(' and ')}.` : 'Everything is running smoothly.';
}

export default function AdminDashboard() {
  const { user } = useAuth();
  const { data, loading, error, reload } = useApi(() => api.dashboard(), [], { refreshInterval: 30000 });

  if (!data) return <LoadState loading={loading} error={error} onRetry={reload} />;
  const { stats, statusBreakdown, advisers, unassigned, weeklyActivity } = data;

  const segments = groupStatuses(Object.fromEntries(statusBreakdown.map((row) => [row.status, row.count])));

  return (
    <div className="dashboard">
      <DashboardHeader subtitle={`${greeting()}, Admin. ${summary(stats)}`}>
        <Link to="/users" className="btn btn-primary btn-lg">
          <Plus size={20} />
          Add User
        </Link>
        <Link to="/schedule" className="btn btn-outline btn-lg">
          Schedule Defense
        </Link>
      </DashboardHeader>

      <div className="kpi-grid stagger">
        <StatCard featured label="Total Theses" value={stats.theses} to="/theses" chip={stats.completed} note="Completed" />
        <StatCard label="Students" value={stats.students} to="/users" chip={stats.advisers} note="Advisers on staff" />
        <StatCard
          label="Pending Reviews"
          value={stats.pending_reviews}
          to="/theses?status=under_review"
          note="Across all advisers"
        />
        <StatCard
          label="Without Adviser"
          value={stats.unassigned}
          to="/theses?adviser=unassigned"
          note={stats.unassigned ? 'Needs assignment' : 'Every thesis is assigned'}
        />
      </div>

      <div className="dash-grid">
        <div className="dash-main">
          <div className="dash-row dash-row-top stagger">
            <WeeklyActivity timestamps={weeklyActivity} title="System Activity" />          </div>
          <div className="dash-row dash-row-bottom stagger">
            <PeopleCard
              title="Adviser Workload"
              action={
                <Link to="/users" className="pill-btn">
                  <Plus size={16} />
                  Add User
                </Link>
              }
              people={advisers.slice(0, 4).map((adviser) => ({
                key: adviser.id,
                name: adviser.name,
                lead: 'Advising',
                detail: `${adviser.advisee_count} ${adviser.advisee_count === 1 ? 'thesis' : 'theses'}`,
                status: adviser.pending_count
                  ? { label: `${adviser.pending_count} pending`, tone: 'active' }
                  : { label: 'Up to date', tone: 'done' },
                to: `/theses?adviser=${adviser.id}`,
              }))}
              emptyIcon={Users}
              emptyTitle="No advisers yet"
            />
            <ProgressGauge
              title="Thesis Progress"
              {...segments}
              caption="Theses Completed"
              labels={['Completed', 'In Progress', 'Draft']}
            />
          </div>
        </div>

        <div className="dash-side stagger">
          <TaskListCard
            title="Unassigned"
            action={
              <Link to="/theses?adviser=unassigned" className="pill-btn">
                View All
              </Link>
            }
            items={unassigned.map((thesis, index) => ({
              key: thesis.id,
              ...THESIS_GLYPHS[index % THESIS_GLYPHS.length],
              title: thesis.title,
              meta: `${thesis.student_name} · ${formatDate(thesis.created_at)}`,
              to: `/theses/${thesis.id}`,
            }))}
            emptyIcon={CircleCheck}
            emptyTitle="Every thesis has an adviser"
          />
          <TimeTracker userId={user.id} />
        </div>
      </div>
    </div>
  );
}
