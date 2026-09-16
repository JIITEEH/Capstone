export const ROLES = ['student', 'adviser', 'admin'];

// Password given to every account created by `npm run db:seed`
export const DEMO_PASSWORD = 'password123';

// Thesis stages in the order students complete them
export const STAGES = {
  proposal: 'Proposal',
  chapters_1_3: 'Chapters 1–3',
  chapters_4_5: 'Chapters 4–5',
  final: 'Final Manuscript',
};

export const THESIS_STATUSES = {
  draft: 'Draft',
  under_review: 'Under review',
  revisions_required: 'Needs revisions',
  in_progress: 'In progress',
  completed: 'Completed',
};

export const REVIEW_DECISIONS = ['approved', 'revisions_requested'];

export const SCHEDULE_TYPES = {
  consultation: 'Consultation',
  proposal_defense: 'Proposal defense',
  final_defense: 'Final defense',
};

export const SCHEDULE_STATUSES = ['scheduled', 'completed', 'cancelled'];

// What each panelist scores a defense on, from 1 (poor) to 5 (excellent)
export const DEFENSE_CRITERIA = {
  content: 'Content and significance',
  methodology: 'Methodology and analysis',
  presentation: 'Presentation',
  answers: "Answers to the panel's questions",
};

export const DEFENSE_VERDICTS = {
  passed: 'Passed',
  passed_with_revisions: 'Passed with revisions',
  failed: 'Failed',
};

export const MEETING_MODES = ['in_person', 'online'];

export const MAX_PANELISTS = 5;

// Most students one thesis group can have, leader included
export const MAX_GROUP_SIZE = 5;

export const ALLOWED_UPLOAD_EXTENSIONS = ['.pdf', '.doc', '.docx'];
