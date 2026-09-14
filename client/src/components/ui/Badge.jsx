import { ROLES, SUBMISSION_STATUS, THESIS_STATUS } from '../../utils/constants.js';

export function Badge({ tone = 'neutral', children }) {
  return <span className={`badge badge-${tone}`}>{children}</span>;
}

export function ThesisStatusBadge({ status }) {
  const info = THESIS_STATUS[status] ?? { label: status, tone: 'neutral' };
  return <Badge tone={info.tone}>{info.label}</Badge>;
}

export function SubmissionStatusBadge({ status }) {
  const info = SUBMISSION_STATUS[status] ?? { label: status, tone: 'neutral' };
  return <Badge tone={info.tone}>{info.label}</Badge>;
}

export function RoleBadge({ role }) {
  const info = ROLES[role] ?? { label: role, tone: 'neutral' };
  return <Badge tone={info.tone}>{info.label}</Badge>;
}
