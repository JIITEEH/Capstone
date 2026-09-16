import * as Activity from '../database-queries/activityModel.js';
import * as Review from '../database-queries/reviewModel.js';
import * as Schedule from '../database-queries/scheduleModel.js';
import * as Stats from '../database-queries/statsModel.js';
import * as Submission from '../database-queries/submissionModel.js';
import * as Thesis from '../database-queries/thesisModel.js';
import * as User from '../database-queries/userModel.js';

function studentDashboard(user) {
  const thesis = Thesis.findByStudent(user.id);
  if (!thesis) return { thesis: null, stats: null, feedback: [], schedule: [], activity: [], weeklyActivity: [] };

  return {
    thesis,
    stats: {
      submissions: thesis.submission_count,
      pending: thesis.pending_count,
      approvedStages: thesis.approved_stages,
      feedback: Review.countFeedbackForStudent(user.id),
    },
    feedback: Review.recentFeedbackForStudent(user.id, 5),
    schedule: Schedule.list({ studentId: user.id, range: 'upcoming', limit: 4 }),
    activity: Activity.listRecent({ thesisId: thesis.id, limit: 8 }),
    weeklyActivity: Activity.listSince({ thesisId: thesis.id }),
  };
}

function adviserDashboard(user) {
  const theses = Thesis.list({ adviserId: user.id });
  const pending = Submission.listPending({ adviserId: user.id });
  return {
    stats: {
      advisees: theses.length,
      pendingReviews: pending.length,
      needsRevision: theses.filter((t) => t.status === 'revisions_required').length,
      completed: theses.filter((t) => t.status === 'completed').length,
    },
    pending,
    theses,
    schedule: Schedule.list({ adviserId: user.id, range: 'upcoming', limit: 4 }),
    activity: Activity.listRecent({ adviserId: user.id, limit: 8 }),
    weeklyActivity: Activity.listSince({ adviserId: user.id }),
  };
}

function adminDashboard() {
  return {
    stats: Stats.overview(),
    statusBreakdown: Stats.statusBreakdown(),
    advisers: User.listAdvisers(),
    unassigned: Thesis.list({ unassigned: true }).slice(0, 5),
    schedule: Schedule.list({ range: 'upcoming', limit: 4 }),
    activity: Activity.listRecent({ limit: 10 }),
    weeklyActivity: Activity.listSince(),
  };
}

export function getDashboard(req, res) {
  const { user } = req;
  if (user.role === 'student') return res.json(studentDashboard(user));
  if (user.role === 'adviser') return res.json(adviserDashboard(user));
  res.json(adminDashboard());
}
