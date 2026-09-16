import { ROLES, SCHEDULE_STATUS, SCHEDULE_TYPES, SUBMISSION_STATUS, THESIS_STATUS } from '../../helpers/constants.js';

export function Badge({ tone = 'neutral', children }) {
  return <span className={`badge badge-${tone}`}>{children}</span>;
}

function makeBadge(map) {
  return function MappedBadge({ value }) {
    const info = map[value] ?? { label: value, tone: 'neutral' };
    return <Badge tone={info.tone}>{info.label}</Badge>;
  };
}

const ThesisBadge = makeBadge(THESIS_STATUS);
const SubmissionBadge = makeBadge(SUBMISSION_STATUS);
const RoleMappedBadge = makeBadge(ROLES);
const TypeBadge = makeBadge(SCHEDULE_TYPES);
const EventStatusBadge = makeBadge(SCHEDULE_STATUS);

export const ThesisStatusBadge = ({ status }) => <ThesisBadge value={status} />;
export const SubmissionStatusBadge = ({ status }) => <SubmissionBadge value={status} />;
export const RoleBadge = ({ role }) => <RoleMappedBadge value={role} />;
export const ScheduleTypeBadge = ({ type }) => <TypeBadge value={type} />;
export const ScheduleStatusBadge = ({ status }) => <EventStatusBadge value={status} />;
