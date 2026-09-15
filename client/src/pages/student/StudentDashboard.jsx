import { Link } from 'react-router';
import { MessageSquare, Plus } from 'lucide-react';
import DashboardHeader from '../../components/dashboard/DashboardHeader.jsx';
import PeopleCard from '../../components/dashboard/PeopleCard.jsx';
import ProgressGauge from '../../components/dashboard/ProgressGauge.jsx';
import TaskListCard, { STAGE_GLYPHS } from '../../components/dashboard/TaskListCard.jsx';
import WeeklyActivity from '../../components/dashboard/WeeklyActivity.jsx';
import { LoadState } from '../../components/ui/Feedback.jsx';
import StageTracker from '../../components/ui/StageTracker.jsx';
import StatCard from '../../components/ui/StatCard.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import useApi from '../../hooks/useApi.js';
import { api } from '../../services/api.js';
import { STAGE_LABELS, STAGES, THESIS_STATUS } from '../../utils/constants.js';
import { approvedStageKeys, greeting, timeAgo } from '../../utils/format.js';

const FEEDBACK_PILLS = {
  approved: { label: 'Approved', tone: 'done' },
  revisions_requested: { label: 'Revisions', tone: 'waiting' },
};

function bannerMessage(thesis, approved) {
  if (thesis.status === 'completed') return 'Every stage of your thesis is approved. Congratulations on finishing!';
  if (!thesis.adviser_id) return 'An administrator will assign your adviser soon. You can already submit your proposal.';
  if (thesis.status === 'revisions_required') {
    return 'Your adviser requested revisions. Review the feedback and upload an updated version.';
  }
  if (thesis.status === 'under_review') return 'Your latest submission is with your adviser for review.';
  const next = STAGES.find((stage) => !approved.includes(stage.key));
  const percent = Math.round((approved.length / STAGES.length) * 100);
  return `You're ${percent}% of the way there. Next up: ${next.label}.`;
}

function stageItems(thesis, approved, currentKey) {
  return STAGES.map((stage, index) => {
    let meta = `Unlocks after ${STAGES[index - 1]?.label}`;
    if (approved.includes(stage.key)) meta = 'Approved by your adviser';
    else if (stage.key === currentKey) meta = `Current stage · ${THESIS_STATUS[thesis.status].label}`;
    return { key: stage.key, ...STAGE_GLYPHS[stage.key], title: stage.label, meta, to: '/thesis' };
  });
}

export default function StudentDashboard() {
  const { user } = useAuth();
  const { data, loading, error, reload } = useApi(() => api.dashboard(), [], { refreshInterval: 30000 });
  const firstName = user.name.split(' ')[0];

  if (!data) return <LoadState loading={loading} error={error} onRetry={reload} />;
  const { thesis, stats, feedback, weeklyActivity } = data;

  if (!thesis) {
    return (
      <div className="dashboard">
        <DashboardHeader
          subtitle={`${greeting()}, ${firstName}. Let's get your thesis started. Add your title and abstract, then submit your proposal when you're ready.`}
        >
          <Link className="btn btn-primary btn-lg" to="/thesis">
            <Plus size={20} />
            Start My Thesis
          </Link>
        </DashboardHeader>
        <section className="dash-card">
          <div className="dash-card-head">
            <h3>Your Thesis Journey</h3>
          </div>
          <p className="muted journey-intro">Each stage is reviewed by your adviser before you move on to the next one.</p>
          <StageTracker approvedKeys={[]} />
        </section>
      </div>
    );
  }

  const approved = approvedStageKeys(thesis);
  const currentKey = STAGES.find((stage) => !approved.includes(stage.key))?.key;
  const percent = Math.round((approved.length / STAGES.length) * 100);

  const feedbackPeople = feedback.slice(0, 4).map((item) => ({
    key: `${item.kind}-${item.id}`,
    name: item.author_name ?? 'Deleted user',
    lead: `${STAGE_LABELS[item.stage]} ·`,
    detail: item.body || (item.decision === 'approved' ? 'Approved with no additional feedback' : 'Revisions requested'),
    status: item.kind === 'review' ? FEEDBACK_PILLS[item.decision] : { label: 'Comment', tone: 'active' },
    to: `/submissions/${item.submission_id}`,
  }));

  return (
    <div className="dashboard">
      <DashboardHeader subtitle={`${greeting()}, ${firstName}. ${bannerMessage(thesis, approved)}`}>
        <Link to="/thesis" className="btn btn-primary btn-lg">
          <Plus size={20} />
          Submit Work
        </Link>
        <Link to="/schedule" className="btn btn-outline btn-lg">
          View Schedule
        </Link>
      </DashboardHeader>

      <div className="kpi-grid stagger">
        <StatCard
          featured
          label="Stages Approved"
          value={stats.approvedStages}
          suffix={`/${STAGES.length}`}
          to="/thesis"
          chip={`${percent}%`}
          note="Of your thesis approved"
        />
        <StatCard
          label="Total Submissions"
          value={stats.submissions}
          to="/thesis"
          chip={stats.submissions - stats.pending}
          note="Already reviewed"
        />
        <StatCard
          label="Feedback Received"
          value={stats.feedback}
          to="/thesis"
          note={feedback.length ? `Latest ${timeAgo(feedback[0].created_at)}` : 'No feedback yet'}
        />
        <StatCard
          label="Awaiting Review"
          value={stats.pending}
          to="/thesis"
          note={stats.pending ? 'With your adviser' : 'Nothing pending'}
        />
      </div>

      <div className="dash-grid">
        <div className="dash-main">
          <div className="dash-row dash-row-top stagger">
            <WeeklyActivity timestamps={weeklyActivity} />          </div>
          <div className="dash-row dash-row-bottom stagger">
            <PeopleCard
              title="Latest Feedback"
              action={
                <Link to="/thesis" className="pill-btn">
                  View Thesis
                </Link>
              }
              people={feedbackPeople}
              emptyIcon={MessageSquare}
              emptyTitle="No feedback yet"
              emptyMessage="Reviews and comments from your adviser will show up here."
            />
            <ProgressGauge
              title="Thesis Progress"
              done={approved.length}
              active={currentKey ? 1 : 0}
              pending={STAGES.length - approved.length - (currentKey ? 1 : 0)}
              caption="Stages Approved"
              labels={['Approved', 'Current', 'Upcoming']}
            />
          </div>
        </div>

        <div className="dash-side stagger">
          <TaskListCard
            title="Thesis Stages"
            action={
              <Link to="/thesis" className="pill-btn">
                <Plus size={16} />
                New
              </Link>
            }
            items={stageItems(thesis, approved, currentKey)}
          />
        </div>
      </div>
    </div>
  );
}
