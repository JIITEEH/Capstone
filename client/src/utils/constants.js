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

export const ROLES = {
  student: { label: 'Student', tone: 'info' },
  adviser: { label: 'Adviser', tone: 'primary' },
  admin: { label: 'Admin', tone: 'neutral' },
};
