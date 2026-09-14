import { Link } from 'react-router';
import { Activity } from 'lucide-react';
import { timeAgo } from '../../utils/format.js';
import Avatar from './Avatar.jsx';
import { EmptyState } from './Feedback.jsx';

export default function ActivityFeed({ items, showThesis = false }) {
  if (!items.length) {
    return <EmptyState compact icon={Activity} title="No activity yet" />;
  }

  return (
    <ul className="activity-list">
      {items.map((item) => (
        <li key={item.id} className="activity-item">
          <Avatar name={item.actor_name ?? 'Deleted user'} size="sm" />
          <div className="activity-text">
            <p>
              <strong>{item.actor_name ?? 'Deleted user'}</strong> {item.action}
            </p>
            <span className="activity-meta">
              {showThesis && (
                <>
                  <Link to={`/theses/${item.thesis_id}`}>{item.student_name}</Link>
                  <span aria-hidden="true"> · </span>
                </>
              )}
              {timeAgo(item.created_at)}
            </span>
          </div>
        </li>
      ))}
    </ul>
  );
}
