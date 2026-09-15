import { Link } from 'react-router';
import { THESIS_STATUS } from '../../utils/constants.js';
import Avatar from '../ui/Avatar.jsx';
import { EmptyState } from '../ui/Feedback.jsx';

const THESIS_TONES = {
  completed: 'done',
  in_progress: 'active',
  under_review: 'active',
  revisions_required: 'waiting',
  draft: 'waiting',
};

export function thesisStatusPill(status) {
  return { label: THESIS_STATUS[status]?.label ?? status, tone: THESIS_TONES[status] ?? 'active' };
}

// tone: 'done' (green), 'active' (amber), 'waiting' (red)
export function StatusPill({ label, tone }) {
  return <span className={`status-pill status-${tone}`}>{label}</span>;
}

// people: [{ key, name, lead, detail, status, to }]
export default function PeopleCard({ title, action, people, emptyIcon, emptyTitle, emptyMessage }) {
  return (
    <section className="dash-card">
      <div className="dash-card-head">
        <h3>{title}</h3>
        {action}
      </div>
      {people.length ? (
        <ul className="people-list">
          {people.map((person) => {
            const body = (
              <>
                <Avatar name={person.name} />
                <span className="people-text">
                  <strong className="clamp-1">{person.name}</strong>
                  <span className="clamp-1">
                    {person.lead} <b>{person.detail}</b>
                  </span>
                </span>
                {person.status && <StatusPill {...person.status} />}
              </>
            );
            return (
              <li key={person.key}>
                {person.to ? (
                  <Link to={person.to} className="people-row">
                    {body}
                  </Link>
                ) : (
                  <div className="people-row">{body}</div>
                )}
              </li>
            );
          })}
        </ul>
      ) : (
        <EmptyState compact icon={emptyIcon} title={emptyTitle} message={emptyMessage} />
      )}
    </section>
  );
}
