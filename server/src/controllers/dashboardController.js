import * as Activity from '../models/activityModel.js';
import * as Comment from '../models/commentModel.js';
import * as Stats from '../models/statsModel.js';
import * as Submission from '../models/submissionModel.js';
import * as Thesis from '../models/thesisModel.js';
import * as User from '../models/userModel.js';

function studentDashboard(user) {
  const thesis = Thesis.findByStudent(user.id);
  if (!thesis) return { thesis: null, stats: null, submissions: [], feedback: [], activity: [] };

  const submissions = Submission.listByThesis(thesis.id);
  return {
    thesis,
    stats: {
      submissions: submissions.length,
      pending: thesis.pending_count,
      approvedStages: thesis.approved_stages,
      feedback: Comment.countForStudent(user.id),
    },
    submissions: submissions.slice(0, 5),
    feedback: Comment.recentForStudent(user.id, 5),
    activity: Activity.listRecent({ thesisId: thesis.id, limit: 8 }),
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
    activity: Activity.listRecent({ adviserId: user.id, limit: 8 }),
  };
}

function adminDashboard() {
  return {
    stats: Stats.overview(),
    statusBreakdown: Stats.statusBreakdown(),
    advisers: User.listAdvisers(),
    unassigned: Thesis.list({ unassigned: true }).slice(0, 5),
    activity: Activity.listRecent({ limit: 10 }),
  };
}

export function getDashboard(req, res) {
  const { user } = req;
  if (user.role === 'student') return res.json(studentDashboard(user));
  if (user.role === 'adviser') return res.json(adviserDashboard(user));
  res.json(adminDashboard());
}
