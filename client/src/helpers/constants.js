export const STAGES = [
  { key: 'proposal', label: 'Proposal' },
  { key: 'chapters_1_3', label: 'Chapters 1–3' },
  { key: 'chapters_4_5', label: 'Chapters 4–5' },
  { key: 'final', label: 'Final Manuscript' },
];

export const STAGE_LABELS = Object.fromEntries(STAGES.map((stage) => [stage.key, stage.label]));

export const THESIS_STATUS = {
  draft: { label: 'Draft', tone: 'neutral' },
  under_review: { label: 'Under review', tone: 'info' },
  revisions_required: { label: 'Needs revisions', tone: 'warning' },
  in_progress: { label: 'In progress', tone: 'primary' },
  completed: { label: 'Completed', tone: 'success' },
};

export const SUBMISSION_STATUS = {
  pending: { label: 'Pending review', tone: 'info' },
  approved: { label: 'Approved', tone: 'success' },
  revisions_requested: { label: 'Revisions requested', tone: 'warning' },
};

export const SCHEDULE_TYPES = {
  consultation: { label: 'Consultation', tone: 'info' },
  proposal_defense: { label: 'Proposal defense', tone: 'primary' },
  final_defense: { label: 'Final defense', tone: 'warning' },
};

export const SCHEDULE_STATUS = {
  scheduled: { label: 'Scheduled', tone: 'info' },
  completed: { label: 'Completed', tone: 'success' },
  cancelled: { label: 'Cancelled', tone: 'danger' },
};

export const MEETING_MODES = { in_person: 'In person', online: 'Online' };

export const DURATIONS = [30, 45, 60, 90, 120, 180];

export const ROLES = {
  student: { label: 'Student', tone: 'info' },
  adviser: { label: 'Adviser', tone: 'primary' },
  admin: { label: 'Admin', tone: 'neutral' },
};
